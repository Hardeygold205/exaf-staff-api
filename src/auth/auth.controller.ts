import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { AuthService } from "./auth.service";
import {
  AcceptInvitationDto,
  AcceptInvitationInput,
  acceptInvitationSchema,
  ChangePasswordDto,
  ChangePasswordInput,
  changePasswordSchema,
  LoginDto,
  LoginInput,
  loginSchema,
  RefreshDto,
  RefreshInput,
  refreshSchema,
  RegisterOrganizationDto,
  RegisterOrganizationInput,
  registerOrganizationSchema,
} from "./auth.schemas";
import { OrganizationsService } from "../organizations/organizations.service";
import { InvitationsService } from "../invitations/invitations.service";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  AuthUser,
} from "../common/decorators/current-user.decorator";
import { ResponseMessage } from "../common/decorators/response-message.decorator";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private organizations: OrganizationsService,
    private invitations: InvitationsService,
  ) {}

  @Post("register-organization")
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Organization registered successfully")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBody({ type: RegisterOrganizationDto })
  async registerOrganization(
    @Body(new ZodValidationPipe(registerOrganizationSchema))
    dto: RegisterOrganizationInput,
    @Req() req: Request,
  ) {
    const { organization, owner } = await this.organizations.register(dto);
    const tokens = await this.authService.createSession(
      owner.id,
      req.ip,
      req.headers["user-agent"],
    );
    return { organization: { id: organization.id, name: organization.name, slug: organization.slug }, ...tokens };
  }

  @Post("accept-invitation")
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Invitation accepted successfully")
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiBody({ type: AcceptInvitationDto })
  async acceptInvitation(
    @Body(new ZodValidationPipe(acceptInvitationSchema)) dto: AcceptInvitationInput,
    @Req() req: Request,
  ) {
    const user = await this.invitations.accept(dto);
    return this.authService.createSession(user.id, req.ip, req.headers["user-agent"]);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Login successful")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBody({ type: LoginDto })
  login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginInput,
    @Req() req: Request,
  ) {
    return this.authService.login(dto, req.ip, req.headers["user-agent"]);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Password changed successfully")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ChangePasswordDto })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: ChangePasswordInput,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Tokens refreshed successfully")
  @ApiBody({ type: RefreshDto })
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) dto: RefreshInput,
    @Req() req: Request,
  ) {
    return this.authService.refresh(
      dto.refreshToken,
      req.ip,
      req.headers["user-agent"],
    );
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Logged out successfully")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.id, user.jti, user.exp);
  }
}
