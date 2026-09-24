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
import {
  CurrentUser,
  AuthUser,
} from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { ProjectsService } from "./projects.service";
import {
  CreateProjectDto,
  CreateProjectInput,
  createProjectSchema,
  UpdateProjectStatusDto,
  UpdateProjectStatusInput,
  updateProjectStatusSchema,
} from "./projects.schemas";

@ApiTags("Projects")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("projects")
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Project created successfully")
  @RequirePermissions("projects:create")
  @ApiBody({ type: CreateProjectDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectInput,
  ) {
    return this.projectsService.create(user, dto);
  }

  @Get()
  @ResponseMessage("Projects retrieved successfully")
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(":id")
  @ResponseMessage("Project retrieved successfully")
  findOne(@Param("id") id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(":id/status")
  @ResponseMessage("Project status updated successfully")
  @RequirePermissions("projects:update_status")
  @ApiBody({ type: UpdateProjectStatusDto })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectStatusSchema))
    dto: UpdateProjectStatusInput,
  ) {
    return this.projectsService.updateStatus(id, user.id, dto);
  }
}
