import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { RedisService } from "../infra/redis/redis.service";
import { CacheKeys } from "../common/cache-keys";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { requireOrgId } from "../common/tenant";
import { loadAccessibleProject } from "../common/project-access";
import { ActivitiesService } from "../activities/activities.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  AddProjectMemberInput,
  CreateProjectInput,
  UpdateProjectInput,
  UpdateProjectStatusInput,
} from "./projects.schemas";

const projectInclude = {
  department: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  members: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          departmentId: true,
        },
      },
    },
  },
  _count: { select: { tasks: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private activities: ActivitiesService,
    private notifications: NotificationsService,
  ) {}

  async create(actor: AuthUser, dto: CreateProjectInput) {
    const organizationId = requireOrgId(actor);
    await this.assertDepartment(organizationId, dto.departmentId);
    const members = this.normalizeMembers(actor.id, dto.members);
    await this.assertMembers(organizationId, members.map((member) => member.userId));

    const project = await this.prisma.project.create({
      data: {
        organizationId,
        departmentId: dto.departmentId ?? undefined,
        name: dto.name.trim(),
        description: dto.description,
        visibility: dto.visibility,
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        createdById: actor.id,
        members: { create: members },
      },
      include: projectInclude,
    });

    await this.redis.del(CacheKeys.projectsList(organizationId));
    await this.activities.logActivity({
      userId: actor.id,
      organizationId,
      action: "PROJECT_CREATED",
      entityType: "Project",
      entityId: project.id,
      description: `Project ${project.name} created (${project.visibility})`,
    });
    return project;
  }

  async findAll(actor: AuthUser) {
    const organizationId = requireOrgId(actor);
    const me = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { departmentId: true },
    });
    const projects = await this.prisma.project.findMany({
      where: { organizationId },
      include: projectInclude,
      orderBy: { updatedAt: "desc" },
    });
    return projects.filter((project) => this.canSee(actor, project, me?.departmentId));
  }

  async findOne(actor: AuthUser, id: string) {
    await loadAccessibleProject(this.prisma, actor, id, "view");
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: projectInclude,
    });
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  async update(actor: AuthUser, id: string, dto: UpdateProjectInput) {
    const organizationId = requireOrgId(actor);
    await loadAccessibleProject(this.prisma, actor, id, "manage");
    await this.assertDepartment(organizationId, dto.departmentId);
    const project = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        departmentId: dto.departmentId,
        visibility: dto.visibility,
        status: dto.status,
        startDate: dto.startDate === undefined ? undefined : dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate === undefined ? undefined : dto.endDate ? new Date(dto.endDate) : null,
      },
      include: projectInclude,
    });
    await this.redis.del(CacheKeys.projectsList(organizationId));
    return project;
  }

  async updateStatus(actor: AuthUser, id: string, dto: UpdateProjectStatusInput) {
    await loadAccessibleProject(this.prisma, actor, id, "manage");
    const project = await this.prisma.project.update({
      where: { id },
      data: { status: dto.status },
      include: projectInclude,
    });
    await this.redis.del(CacheKeys.projectsList(project.organizationId));
    await this.activities.logActivity({
      userId: actor.id,
      organizationId: project.organizationId,
      action: "PROJECT_STATUS_UPDATED",
      entityType: "Project",
      entityId: id,
      description: `Project status set to ${dto.status}`,
    });
    return project;
  }

  async addMember(actor: AuthUser, id: string, dto: AddProjectMemberInput) {
    const project = await loadAccessibleProject(this.prisma, actor, id, "manage");
    await this.assertMembers(project.organizationId, [dto.userId]);
    const member = await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId: dto.userId } },
      update: { role: dto.role },
      create: { projectId: id, userId: dto.userId, role: dto.role },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, departmentId: true } } },
    });
    await this.notifications.createNotification({
      userId: dto.userId,
      title: "Project access granted",
      message: `You were added to ${project.name} as ${dto.role}.`,
      type: "PROJECT",
      link: `/projects/${id}`,
    });
    await this.activities.logActivity({
      userId: actor.id,
      organizationId: project.organizationId,
      action: "PROJECT_MEMBER_ADDED",
      entityType: "Project",
      entityId: id,
      description: `Added ${member.user.email} to project as ${dto.role}`,
    });
    return member;
  }

  async removeMember(actor: AuthUser, id: string, userId: string) {
    const project = await loadAccessibleProject(this.prisma, actor, id, "manage");
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId: id, userId } },
    });
    await this.activities.logActivity({
      userId: actor.id,
      organizationId: project.organizationId,
      action: "PROJECT_MEMBER_REMOVED",
      entityType: "Project",
      entityId: id,
      description: `Removed a member from ${project.name}`,
    });
    return { removed: true };
  }

  private canSee(
    actor: AuthUser,
    project: {
      visibility: string;
      departmentId: string | null;
      createdById: string;
      members: { userId: string }[];
    },
    actorDepartmentId?: string | null,
  ) {
    if (actor.isPlatformAdmin) return true;
    if (project.visibility === "PUBLIC") return true;
    if (project.createdById === actor.id) return true;
    if (project.members.some((member) => member.userId === actor.id)) return true;
    if (
      project.visibility === "DEPARTMENT" &&
      project.departmentId &&
      actorDepartmentId &&
      project.departmentId === actorDepartmentId
    ) {
      return true;
    }
    return false;
  }

  private normalizeMembers(
    actorId: string,
    members: { userId: string; role: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER" }[],
  ) {
    const map = new Map<string, "OWNER" | "MANAGER" | "MEMBER" | "VIEWER">();
    map.set(actorId, "OWNER");
    for (const member of members) map.set(member.userId, member.role);
    return [...map.entries()].map(([userId, role]) => ({ userId, role }));
  }

  private async assertDepartment(organizationId: string, departmentId?: string | null) {
    if (!departmentId) return;
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId, isActive: true },
    });
    if (!department) throw new BadRequestException("Department is not part of this organization");
  }

  private async assertMembers(organizationId: string, userIds: string[]) {
    const unique = [...new Set(userIds)];
    if (!unique.length) return;
    const count = await this.prisma.user.count({
      where: { id: { in: unique }, organizationId, isActive: true },
    });
    if (count !== unique.length) {
      throw new BadRequestException("One or more members are not active in this organization");
    }
  }
}
