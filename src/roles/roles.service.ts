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

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private eventsGateway: EventsGateway,
  ) {}

  findAllRoles() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
  }

  findAllPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: "asc" } });
  }

  async create(dto: CreateRoleInput) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing)
      throw new ConflictException(`Role ${dto.name} already exists`);

    return this.prisma.role.create({
      data: { name: dto.name, description: dto.description },
    });
  }

  async setPermissions(roleId: string, dto: SetRolePermissionsInput) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException("Role not found");

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: dto.permissionKeys } },
    });
    if (permissions.length !== dto.permissionKeys.length) {
      const found = permissions.map((p) => p.key);
      const missing = dto.permissionKeys.filter((k) => !found.includes(k));
      throw new BadRequestException(
        `Unknown permission(s): ${missing.join(", ")}`,
      );
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    if (permissions.length) {
      await this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      });
    }

    await this.redis.del(CacheKeys.rolePermissions(role.name));

    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });

    const userIds = userRoles.map((ur) => ur.userId);

    if (userIds.length > 0) {
      this.eventsGateway.notifyUsersPermissionUpdate(userIds);
    }

    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
  }
}
