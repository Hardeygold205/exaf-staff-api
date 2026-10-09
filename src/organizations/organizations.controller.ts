import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import {
  CurrentUser,
  AuthUser,
} from "../common/decorators/current-user.decorator";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { requireOrgId } from "../common/tenant";
import { OrganizationsService } from "./organizations.service";
import {
  SetOrganizationStatusDto,
  SetOrganizationStatusInput,
  setOrganizationStatusSchema,
  UpdateOrganizationDto,
  UpdateOrganizationInput,
  updateOrganizationSchema,
  UpdateOrganizationSettingsDto,
  UpdateOrganizationSettingsInput,
  updateOrganizationSettingsSchema,
} from "./organizations.schemas";

@ApiTags("Organizations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(private organizations: OrganizationsService) {}

  @Get("me")
  @ResponseMessage("Organization retrieved successfully")
  mine(@CurrentUser() user: AuthUser) {
    return this.organizations.findMine(requireOrgId(user));
  }

  @Patch("me")
  @ResponseMessage("Organization updated successfully")
  @RequirePermissions("roles:manage")
  @ApiBody({ type: UpdateOrganizationDto })
  updateMine(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateOrganizationSchema))
    dto: UpdateOrganizationInput,
  ) {
    return this.organizations.updateMine(requireOrgId(user), dto, user.id);
  }

  @Patch("me/settings")
  @ResponseMessage("Organization settings updated successfully")
  @RequirePermissions("roles:manage")
  @ApiBody({ type: UpdateOrganizationSettingsDto })
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateOrganizationSettingsSchema))
    dto: UpdateOrganizationSettingsInput,
  ) {
    return this.organizations.updateSettings(requireOrgId(user), dto, user.id);
  }

  @Post("me/logo")
  @ResponseMessage("Organization logo updated successfully")
  @RequirePermissions("roles:manage")
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
  uploadLogo(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.organizations.uploadBrand(
      requireOrgId(user),
      user.id,
      "logo",
      file,
    );
  }

  @Post("me/icon")
  @ResponseMessage("Organization icon updated successfully")
  @RequirePermissions("roles:manage")
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
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadIcon(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.organizations.uploadBrand(
      requireOrgId(user),
      user.id,
      "icon",
      file,
    );
  }

  @Get()
  @ResponseMessage("Organizations retrieved successfully")
  @RequirePermissions("organizations:manage")
  listAll() {
    return this.organizations.listAll();
  }

  @Patch(":id/status")
  @ResponseMessage("Organization status updated successfully")
  @RequirePermissions("organizations:manage")
  @ApiBody({ type: SetOrganizationStatusDto })
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(setOrganizationStatusSchema))
    dto: SetOrganizationStatusInput,
  ) {
    return this.organizations.setStatus(id, dto.isActive, user.id);
  }
}
