import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { ActivitiesService } from "../activities/activities.service";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { assertSameOrg, requireOrgId } from "../common/tenant";
import { CreateBranchInput, UpdateBranchInput } from "./branches.schemas";

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private activities: ActivitiesService,
  ) {}

  async create(actor: AuthUser, dto: CreateBranchInput) {
    const organizationId = requireOrgId(actor);
    try {
      const branch = await this.prisma.officeBranch.create({
        data: { organizationId, ...dto, name: dto.name.trim() },
      });
      await this.activities.logActivity({
        userId: actor.id,
        organizationId,
        action: "BRANCH_CREATED",
        entityType: "OfficeBranch",
        entityId: branch.id,
        description: `Office branch ${branch.name} created`,
      });
      return branch;
    } catch (error: any) {
      if (error?.code === "P2002") throw new ConflictException("A branch with this name already exists");
      throw error;
    }
  }

  findAll(actor: AuthUser) {
    return this.prisma.officeBranch.findMany({
      where: { organizationId: requireOrgId(actor) },
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateBranchInput) {
    await this.getInOrg(actor, id);
    try {
      return await this.prisma.officeBranch.update({
        where: { id },
        data: { ...dto, name: dto.name?.trim() },
      });
    } catch (error: any) {
      if (error?.code === "P2002") throw new ConflictException("A branch with this name already exists");
      throw error;
    }
  }

  async deactivate(actor: AuthUser, id: string) {
    await this.getInOrg(actor, id);
    return this.prisma.officeBranch.update({ where: { id }, data: { isActive: false } });
  }

  private async getInOrg(actor: AuthUser, id: string) {
    const branch = await this.prisma.officeBranch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException("Office branch not found");
    assertSameOrg(actor, branch.organizationId);
    return branch;
  }
}
