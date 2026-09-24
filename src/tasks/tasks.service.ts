import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { ActivitiesService } from "../activities/activities.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from "./tasks.schemas";

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private activities: ActivitiesService,
    private notifications: NotificationsService,
  ) {}

  async findByProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException("Project not found");

    return this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        creator: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { uploads: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, status: true } },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }

  async create(
    projectId: string,
    actor: { id: string; permissions: string[] },
    dto: CreateTaskInput,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException("Project not found");

    if (dto.assigneeId) {
      await this.ensureActiveUser(dto.assigneeId);
      if (
        dto.assigneeId !== actor.id &&
        !actor.permissions.includes("tasks:assign")
      ) {
        throw new ForbiddenException(
          "You do not have permission to assign tasks to other staff members",
        );
      }
    }

    const task = await this.prisma.task.create({
      data: {
        projectId,
        creatorId: actor.id,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate
          ? new Date(dto.dueDate)
          : dto.dueDate === null
            ? null
            : undefined,
      },
    });

    await this.activities.logActivity({
      userId: actor.id,
      action: "TASK_CREATED",
      entityType: "Task",
      entityId: task.id,
      description: `Task "${task.title}" created in project "${project.name}"`,
    });

    if (dto.assigneeId) {
      await this.notifications.createNotification({
        userId: dto.assigneeId,
        title: "Task Assigned",
        message: `You were assigned task "${task.title}" in project "${project.name}".`,
        type: "TASK_ASSIGNMENT",
        link: `/projects/${projectId}`,
      });
    }

    return this.findOne(task.id);
  }

  async update(
    id: string,
    actor: { id: string; permissions: string[] },
    dto: UpdateTaskInput,
  ) {
    const task = await this.findOne(id);
    const canManage = actor.permissions.includes("tasks:manage");
    if (
      !canManage &&
      task.assignee?.id !== actor.id &&
      task.creatorId !== actor.id
    ) {
      throw new ForbiddenException(
        "You can only edit tasks assigned to you or created by you",
      );
    }
    if (dto.assigneeId) {
      await this.ensureActiveUser(dto.assigneeId);
      if (
        dto.assigneeId !== actor.id &&
        !actor.permissions.includes("tasks:assign")
      ) {
        throw new ForbiddenException(
          "You do not have permission to assign tasks to other staff members",
        );
      }
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        dueDate:
          dto.dueDate === undefined
            ? undefined
            : dto.dueDate === null
              ? null
              : new Date(dto.dueDate),
      },
    });

    await this.activities.logActivity({
      userId: actor.id,
      action: "TASK_UPDATED",
      entityType: "Task",
      entityId: id,
      description: `Task "${task.title}" was updated`,
    });

    if (dto.assigneeId && dto.assigneeId !== task.assignee?.id) {
      await this.notifications.createNotification({
        userId: dto.assigneeId,
        title: "Task Assigned",
        message: `You were assigned task "${updated.title}".`,
        type: "TASK_ASSIGNMENT",
        link: `/projects/${task.project.id}/tasks/${id}`,
      });
    }

    return this.findOne(id);
  }

  async updateStatus(
    id: string,
    user: { id: string; permissions: string[] },
    dto: UpdateTaskStatusInput,
  ) {
    const task = await this.findOne(id);
    const canManageAny = user.permissions.includes("tasks:manage_status");
    if (
      !canManageAny &&
      task.assignee?.id !== user.id &&
      task.creatorId !== user.id
    ) {
      throw new ForbiddenException(
        "Only the task assignee or creator can update this task status",
      );
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.activities.logActivity({
      userId: user.id,
      action: "TASK_STATUS_UPDATED",
      entityType: "Task",
      entityId: id,
      description: `Task "${task.title}" status updated to ${dto.status}`,
    });
    return updated;
  }

  async remove(id: string, userId: string) {
    const task = await this.findOne(id);
    await this.prisma.task.delete({ where: { id } });
    await this.activities.logActivity({
      userId,
      action: "TASK_DELETED",
      entityType: "Task",
      entityId: id,
      description: `Task "${task.title}" was deleted`,
    });
    return null;
  }

  private async ensureActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive)
      throw new BadRequestException("Assignee is not an active staff member");
  }
}
