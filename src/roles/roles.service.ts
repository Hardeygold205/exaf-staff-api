import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { RedisService } from "../infra/redis/redis.service";
import { CacheKeys } from "../common/cache-keys";
import { CreateRoleInput, SetRolePermissionsInput } from "./roles.schemas";
import { EventsGateway } from "../infra/socket/events.gateway";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { assertSameOrg, requireOrgId } from "../common/tenant";
import { PLATFORM_ONLY_PERMISSIONS } from "../organizations/default-roles";

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private eventsGateway: EventsGateway,
  ) {}

  findAllRoles(actor: AuthUser) {
    return this.prisma.role.findMany({
      where: { organizationId: requireOrgId(actor) },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
  }

  findAllPermissions(actor: AuthUser) {
    return this.prisma.permission.findMany({
      where: actor.isPlatformAdmin
        ? undefined
        : { key: { notIn: [...PLATFORM_ONLY_PERMISSIONS] } },
      orderBy: { key: "asc" },
    });
  }

  async create(actor: AuthUser, dto: CreateRoleInput) {
    const organizationId = requireOrgId(actor);
    const existing = await this.prisma.role.findFirst({
      where: { organizationId, name: dto.name },
    });
    if (existing)
      throw new ConflictException(`Role ${dto.name} already exists`);

    const permissions = await this.resolvePermissions(dto.permissionKeys);
    const role = await this.prisma.role.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        isSystem: false,
        permissions: permissions.length
          ? {
              create: permissions.map((permission) => ({
                permissionId: permission.id,
              })),
            }
          : undefined,
      },
      include: { permissions: { include: { permission: true } } },
    });
    return role;
  }

  async setPermissions(
    actor: AuthUser,
    roleId: string,
    dto: SetRolePermissionsInput,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException("Role not found");
    assertSameOrg(actor, role.organizationId);
    if (role.isSystem && role.name === "ORG_OWNER") {
      throw new BadRequestException(
        "The organization owner role cannot be edited",
      );
    }

    const permissions = await this.resolvePermissions(dto.permissionKeys);

    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    if (permissions.length) {
      await this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      });
    }

    await this.redis.del(CacheKeys.rolePermissions(role.id));
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    const userIds = userRoles.map((ur) => ur.userId);
    if (userIds.length > 0)
      this.eventsGateway.notifyUsersPermissionUpdate(userIds);

    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
  }

  private async resolvePermissions(permissionKeys: string[]) {
    const unique = [...new Set(permissionKeys)];
    const blocked = unique.filter((key) =>
      PLATFORM_ONLY_PERMISSIONS.includes(key),
    );
    if (blocked.length) {
      throw new BadRequestException(
        `These permissions are platform-only and cannot be granted to an organization role: ${blocked.join(", ")}`,
      );
    }
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: unique } },
    });
    if (permissions.length !== unique.length) {
      const found = new Set(permissions.map((permission) => permission.key));
      const missing = unique.filter((key) => !found.has(key));
      throw new BadRequestException(
        `Unknown permission(s): ${missing.join(", ")}`,
      );
    }
    return permissions;
  }
}
