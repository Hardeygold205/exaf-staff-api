import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { DepartmentsService } from "./departments.service";
import {
  CreateDepartmentDto,
  CreateDepartmentInput,
  createDepartmentSchema,
  UpdateDepartmentDto,
  UpdateDepartmentInput,
  updateDepartmentSchema,
} from "./departments.schemas";

@ApiTags("Departments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("departments")
export class DepartmentsController {
  constructor(private departments: DepartmentsService) {}

  @Post()
  @ResponseMessage("Department created successfully")
  @RequirePermissions("departments:manage")
  @ApiBody({ type: CreateDepartmentDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createDepartmentSchema)) dto: CreateDepartmentInput,
  ) {
    return this.departments.create(user, dto);
  }

  @Get()
  @ResponseMessage("Departments retrieved successfully")
  @RequirePermissions("departments:view")
  findAll(@CurrentUser() user: AuthUser) {
    return this.departments.findAll(user);
  }

  @Patch(":id")
  @ResponseMessage("Department updated successfully")
  @RequirePermissions("departments:manage")
  @ApiBody({ type: UpdateDepartmentDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateDepartmentSchema)) dto: UpdateDepartmentInput,
  ) {
    return this.departments.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @ResponseMessage("Department deactivated successfully")
  @RequirePermissions("departments:manage")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.departments.remove(user, id);
  }
}
