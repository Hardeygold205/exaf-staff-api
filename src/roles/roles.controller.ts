import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { RolesService } from "./roles.service";
import {
  CreateRoleDto,
  CreateRoleInput,
  createRoleSchema,
  SetRolePermissionsDto,
  SetRolePermissionsInput,
  setRolePermissionsSchema,
} from "./roles.schemas";

@ApiTags("Roles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("roles")
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @ResponseMessage("Roles retrieved successfully")
  @RequirePermissions("roles:view")
  findAllRoles() {
    return this.rolesService.findAllRoles();
  }

  @Get("permissions")
  @ResponseMessage("Permissions retrieved successfully")
  @RequirePermissions("roles:view")
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Role created successfully")
  @RequirePermissions("roles:manage")
  @ApiBody({ type: CreateRoleDto })
  create(@Body(new ZodValidationPipe(createRoleSchema)) dto: CreateRoleInput) {
    return this.rolesService.create(dto);
  }

  @Patch(":id/permissions")
  @ResponseMessage("Role permissions updated successfully")
  @RequirePermissions("roles:manage")
  @ApiBody({ type: SetRolePermissionsDto })
  setPermissions(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(setRolePermissionsSchema))
    dto: SetRolePermissionsInput,
  ) {
    return this.rolesService.setPermissions(id, dto);
  }
}
