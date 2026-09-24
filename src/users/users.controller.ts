import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import {
  CurrentUser,
  AuthUser,
} from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { UsersService } from "./users.service";
import {
  AdminUpdateUserDto,
  AdminUpdateUserInput,
  adminUpdateUserSchema,
  CreateUserDto,
  CreateUserInput,
  createUserSchema,
  SetUserPermissionsDto,
  SetUserPermissionsInput,
  setUserPermissionsSchema,
  UpdateMeDto,
  UpdateMeInput,
  updateMeSchema,
} from "./users.schemas";
import {
  SetAttendanceExemptionDto,
  setAttendanceExemptionSchema,
  SetAttendanceExemptionInput,
} from "../attendance/attendance-exemption.schemas";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("User created successfully")
  @RequirePermissions("users:create")
  @ApiBody({ type: CreateUserDto })
  create(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserInput,
  ) {
    return this.usersService.create(dto, actor);
  }

  @Get("me")
  @ResponseMessage("User profile retrieved successfully")
  findMe(@CurrentUser() user: AuthUser) {
    return this.usersService.findMe(user.id);
  }

  @Patch("me")
  @ResponseMessage("Profile updated successfully")
  @ApiBody({ type: UpdateMeDto })
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateMeSchema)) dto: UpdateMeInput,
  ) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Post("me/avatar")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Avatar uploaded successfully")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(user.id, file);
  }

  @Get("emails")
  @ResponseMessage("Directory emails retrieved successfully")
  findDirectoryEmails() {
    return this.usersService.findDirectoryEmails();
  }

  @Get()
  @ResponseMessage("Users retrieved successfully")
  @RequirePermissions("users:view")
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(":id")
  @ResponseMessage("User updated successfully")
  @RequirePermissions("users:manage")
  @ApiBody({ type: AdminUpdateUserDto })
  adminUpdate(
    @Param("id") id: string,
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(adminUpdateUserSchema))
    dto: AdminUpdateUserInput,
  ) {
    return this.usersService.adminUpdate(id, dto, actor);
  }

  @Patch(":id/permissions")
  @ResponseMessage("User permissions updated successfully")
  @RequirePermissions("users:manage_permissions")
  @ApiBody({ type: SetUserPermissionsDto })
  setPermissions(
    @Param("id") id: string,
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(setUserPermissionsSchema))
    dto: SetUserPermissionsInput,
  ) {
    return this.usersService.setPermissionOverrides(id, dto, actor);
  }

  @Patch(":id/attendance-exemption")
  @ResponseMessage("User attendance exemption updated successfully")
  @RequirePermissions("attendance:manage_exemption")
  @ApiBody({ type: SetAttendanceExemptionDto })
  setAttendanceExemption(
    @Param("id") id: string,
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(setAttendanceExemptionSchema))
    dto: SetAttendanceExemptionInput,
  ) {
    return this.usersService.setAttendanceExemption(id, dto.exempt, actor.id);
  }

  @Post(":id/reset-password")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Password reset successfully")
  @RequirePermissions("users:reset_password")
  resetPassword(@Param("id") id: string, @CurrentUser() admin: AuthUser) {
    return this.usersService.resetPassword(id, admin.id);
  }

  @Patch(":id/deactivate")
  @ResponseMessage("User deactivated successfully")
  @RequirePermissions("users:manage")
  deactivate(@Param("id") id: string) {
    return this.usersService.deactivate(id);
  }
}
