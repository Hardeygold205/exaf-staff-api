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
import {
  CurrentUser,
  AuthUser,
} from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { TasksService } from "./tasks.service";
import {
  CreateTaskDto,
  CreateTaskInput,
  createTaskSchema,
  UpdateTaskDto,
  UpdateTaskInput,
  updateTaskSchema,
  UpdateTaskStatusDto,
  UpdateTaskStatusInput,
  updateTaskStatusSchema,
} from "./tasks.schemas";

@ApiTags("Tasks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get("projects/:projectId/tasks")
  @ResponseMessage("Tasks retrieved successfully")
  findByProject(@Param("projectId") projectId: string) {
    return this.tasksService.findByProject(projectId);
  }

  @Post("projects/:projectId/tasks")
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Task created successfully")
  @RequirePermissions("tasks:create")
  @ApiBody({ type: CreateTaskDto })
  create(
    @Param("projectId") projectId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createTaskSchema)) dto: CreateTaskInput,
  ) {
    return this.tasksService.create(projectId, user, dto);
  }

  @Get("tasks/:id")
  @ResponseMessage("Task retrieved successfully")
  findOne(@Param("id") id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch("tasks/:id")
  @ResponseMessage("Task updated successfully")
  @RequirePermissions("tasks:edit")
  @ApiBody({ type: UpdateTaskDto })
  update(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateTaskSchema)) dto: UpdateTaskInput,
  ) {
    return this.tasksService.update(id, user, dto);
  }

  @Patch("tasks/:id/status")
  @ResponseMessage("Task status updated successfully")
  @ApiBody({ type: UpdateTaskStatusDto })
  updateStatus(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateTaskStatusSchema))
    dto: UpdateTaskStatusInput,
  ) {
    return this.tasksService.updateStatus(id, user, dto);
  }

  @Delete("tasks/:id")
  @ResponseMessage("Task deleted successfully")
  @RequirePermissions("tasks:delete")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.tasksService.remove(id, user.id);
  }
}
