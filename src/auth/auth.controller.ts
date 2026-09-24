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
  ChangePasswordDto,
  ChangePasswordInput,
  changePasswordSchema,
  LoginDto,
  LoginInput,
  loginSchema,
  RefreshDto,
  RefreshInput,
  refreshSchema,
} from "./auth.schemas";
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
  constructor(private authService: AuthService) {}

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
