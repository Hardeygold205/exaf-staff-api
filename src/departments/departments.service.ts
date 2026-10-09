import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { ActivitiesService } from "../activities/activities.service";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { assertSameOrg, requireOrgId } from "../common/tenant";
import {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "./departments.schemas";

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private activities: ActivitiesService,
  ) {}

  async create(actor: AuthUser, dto: CreateDepartmentInput) {
    const organizationId = requireOrgId(actor);
    await this.assertHead(organizationId, dto.headUserId);
    try {
      const department = await this.prisma.department.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          description: dto.description,
          headUserId: dto.headUserId ?? undefined,
        },
      });
      await this.activities.logActivity({
        userId: actor.id,
        organizationId,
        action: "DEPARTMENT_CREATED",
        entityType: "Department",
        entityId: department.id,
        description: `Department ${department.name} created`,
      });
      return department;
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new ConflictException("A department with this name already exists");
      }
      throw error;
    }
  }

  async findAll(actor: AuthUser) {
    return this.prisma.department.findMany({
      where: { organizationId: requireOrgId(actor) },
      orderBy: { name: "asc" },
      include: {
        headUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { users: true, projects: true } },
      },
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateDepartmentInput) {
    const department = await this.getInOrg(actor, id);
    if (dto.headUserId) await this.assertHead(department.organizationId, dto.headUserId);
    try {
      return await this.prisma.department.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description,
          headUserId: dto.headUserId,
          isActive: dto.isActive,
        },
      });
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new ConflictException("A department with this name already exists");
      }
      throw error;
    }
  }

  async remove(actor: AuthUser, id: string) {
    await this.getInOrg(actor, id);
    return this.prisma.department.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async getInOrg(actor: AuthUser, id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException("Department not found");
    assertSameOrg(actor, department.organizationId);
    return department;
  }

  private async assertHead(organizationId: string, headUserId?: string | null) {
    if (!headUserId) return;
    const user = await this.prisma.user.findFirst({
      where: { id: headUserId, organizationId, isActive: true },
    });
    if (!user) throw new NotFoundException("Department head must be an active member of this organization");
  }
}
