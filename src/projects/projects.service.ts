import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../infra/prisma/prisma.service";
import { RedisService } from "../infra/redis/redis.service";
import { CacheKeys } from "../common/cache-keys";
import {
  CreateProjectInput,
  UpdateProjectStatusInput,
} from "./projects.schemas";
import { ActivitiesService } from "../activities/activities.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
    private activities: ActivitiesService,
    private notifications: NotificationsService,
  ) {}

  async create(
    actor: { id: string; permissions: string[] },
    dto: CreateProjectInput,
  ) {
    if (
      dto.memberUserIds.length &&
      !actor.permissions.includes("projects:manage_members")
    ) {
      const uniqueMembers = [...new Set(dto.memberUserIds)];
      if (uniqueMembers.some((userId) => userId !== actor.id)) {
        throw new BadRequestException(
          "You do not have permission to add other staff members to a project",
        );
      }
    }
    if (dto.memberUserIds.length) {
      const count = await this.prisma.user.count({
        where: { id: { in: dto.memberUserIds }, isActive: true },
      });
      if (count !== new Set(dto.memberUserIds).size) {
        throw new BadRequestException(
          "One or more project members are invalid or inactive",
        );
      }
    }

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate
          ? new Date(dto.startDate)
          : dto.startDate === null
            ? null
            : undefined,
        endDate: dto.endDate
          ? new Date(dto.endDate)
          : dto.endDate === null
            ? null
            : undefined,
        createdById: actor.id,
        members: dto.memberUserIds.length
          ? { create: dto.memberUserIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: { members: true },
    });

    await this.redis.del(CacheKeys.projectsList);
    await this.activities.logActivity({
      userId: actor.id,
      action: "PROJECT_CREATED",
      entityType: "Project",
      entityId: project.id,
      description: `Project "${project.name}" was created`,
    });

    if (dto.memberUserIds.length) {
      await this.notifications.createBulkNotifications(dto.memberUserIds, {
        title: "Added to Project",
        message: `You were added as a member to project "${project.name}".`,
        type: "PROJECT_ASSIGNMENT",
        link: `/projects/${project.id}`,
      });
    }

    return project;
  }

  async findAll() {
    const cached = await this.redis.get<unknown>(CacheKeys.projectsList);
    if (cached) return cached;

    const projects = await this.prisma.project.findMany({
      include: {
        _count: { select: { tasks: true, members: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const ttl = Number(this.config.get("CACHE_TTL_SECONDS", 60));
    await this.redis.set(CacheKeys.projectsList, projects, ttl);
    return projects;
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        tasks: {
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
        },
      },
    });
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  async updateStatus(
    id: string,
    userId: string,
    dto: UpdateProjectStatusInput,
  ) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Project not found");

    const project = await this.prisma.project.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.redis.del(CacheKeys.projectsList);
    await this.activities.logActivity({
      userId,
      action: "PROJECT_STATUS_UPDATED",
      entityType: "Project",
      entityId: id,
      description: `Project "${existing.name}" status updated to ${dto.status}`,
    });
    return project;
  }
}
