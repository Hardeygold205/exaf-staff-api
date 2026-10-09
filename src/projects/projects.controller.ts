import {
  Body,
  Controller,
  Delete,
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
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { ProjectsService } from "./projects.service";
import {
  AddProjectMemberDto,
  AddProjectMemberInput,
  addProjectMemberSchema,
  CreateProjectDto,
  CreateProjectInput,
  createProjectSchema,
  UpdateProjectDto,
  UpdateProjectInput,
  updateProjectSchema,
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
  findAll(@CurrentUser() user: AuthUser) {
    return this.projectsService.findAll(user);
  }

  @Get(":id")
  @ResponseMessage("Project retrieved successfully")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.projectsService.findOne(user, id);
  }

  @Patch(":id")
  @ResponseMessage("Project updated successfully")
  @RequirePermissions("projects:update")
  @ApiBody({ type: UpdateProjectDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectInput,
  ) {
    return this.projectsService.update(user, id, dto);
  }

  @Patch(":id/status")
  @ResponseMessage("Project status updated successfully")
  @RequirePermissions("projects:update_status")
  @ApiBody({ type: UpdateProjectStatusDto })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectStatusSchema)) dto: UpdateProjectStatusInput,
  ) {
    return this.projectsService.updateStatus(user, id, dto);
  }

  @Post(":id/members")
  @ResponseMessage("Project member added successfully")
  @RequirePermissions("projects:manage_members")
  @ApiBody({ type: AddProjectMemberDto })
  addMember(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addProjectMemberSchema)) dto: AddProjectMemberInput,
  ) {
    return this.projectsService.addMember(user, id, dto);
  }

  @Delete(":id/members/:userId")
  @ResponseMessage("Project member removed successfully")
  @RequirePermissions("projects:manage_members")
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("userId") userId: string,
  ) {
    return this.projectsService.removeMember(user, id, userId);
  }
}
