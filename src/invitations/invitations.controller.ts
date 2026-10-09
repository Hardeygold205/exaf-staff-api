import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { InvitationsService } from "./invitations.service";
import {
  CreateInvitationDto,
  CreateInvitationInput,
  createInvitationSchema,
} from "./invitations.schemas";

@ApiTags("Invitations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("invitations")
export class InvitationsController {
  constructor(private invitations: InvitationsService) {}

  @Post()
  @ResponseMessage("Invitation sent successfully")
  @RequirePermissions("invitations:manage")
  @ApiBody({ type: CreateInvitationDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createInvitationSchema)) dto: CreateInvitationInput,
  ) {
    return this.invitations.create(user, dto);
  }

  @Get()
  @ResponseMessage("Invitations retrieved successfully")
  @RequirePermissions("invitations:manage")
  findAll(@CurrentUser() user: AuthUser) {
    return this.invitations.findAll(user);
  }

  @Patch(":id/cancel")
  @ResponseMessage("Invitation cancelled successfully")
  @RequirePermissions("invitations:manage")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.invitations.cancel(user, id);
  }
}
