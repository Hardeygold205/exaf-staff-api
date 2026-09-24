import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { PrismaService } from "../infra/prisma/prisma.service";
import { RedisService } from "../infra/redis/redis.service";
import { StorageService } from "../infra/storage/storage.service";
import { EventsGateway } from "../infra/socket/events.gateway";
import { CacheKeys } from "../common/cache-keys";
import { AuthUser } from "../common/decorators/current-user.decorator";
import {
  AdminUpdateUserInput,
  CreateUserInput,
  SetUserPermissionsInput,
  UpdateMeInput,
} from "./users.schemas";
import { MailService } from "../infra/mail/mail.service";
import { ActivitiesService } from "../activities/activities.service";
import { NotificationsService } from "../notifications/notifications.service";
import { escapeHtml } from "../common/escape-html.util";

const directorySelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  middleName: true,
  username: true,
  department: true,
  position: true,
  officeBranch: true,
  shift: true,
  isIntern: true,
  bio: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
  roles: { select: { role: { select: { name: true } } } },
  permissionOverrides: {
    select: {
      granted: true,
      permission: { select: { key: true } },
    },
  },
} as const;

function formatUserPermissions<
  T extends {
    permissionOverrides?: Array<{
      granted: boolean;
      permission: { key: string };
    }>;
  },
>(user: T) {
  const { permissionOverrides, ...rest } = user;
  return {
    ...rest,
    permissionGrants:
      permissionOverrides
        ?.filter((p) => p.granted)
        .map((p) => p.permission.key) ?? [],
    permissionRevokes:
      permissionOverrides
        ?.filter((p) => !p.granted)
        .map((p) => p.permission.key) ?? [],
  };
}

const meSelect = {
  ...directorySelect,
  dateOfBirth: true,
  mustChangePassword: true,
} as const;

const privilegedRoles = new Set(["SUPERADMIN", "CEO", "COO", "FINANCE_LEAD"]);
const roleAssignmentPermission = "users:assign_roles";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateUserInput, actor: AuthUser) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing)
      throw new ConflictException("A user with this email already exists");

    await this.ensureUsernameAvailable(dto.username);
    const roles = await this.resolveRoles(dto.roleNames);
    this.ensureRoleAssignmentAllowed(
      actor,
      roles.map((role) => role.name),
    );

    const temporaryPassword = crypto.randomBytes(16).toString("hex");
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName,
        username: dto.username,
        department: dto.department,
        position: dto.position,
        isIntern: dto.isIntern,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        bio: dto.bio,
        passwordHash,
        mustChangePassword: true,
        roles: { create: roles.map((role) => ({ roleId: role.id })) },
      },
      select: meSelect,
    });

    await this.redis.del(CacheKeys.usersDirectory);

    try {
      await this.mail.send({
        to: [user.email],
        subject: "Welcome to EXAF Staff Platform - Your Account Credentials",
        html: `
          <h2>Welcome to EXAF Staff Platform, ${escapeHtml(user.firstName)}!</h2>
          <p>Your staff account has been created.</p>
          <ul>
            <li><strong>Email:</strong> ${escapeHtml(user.email)}</li>
            <li><strong>Temporary Password:</strong> <code>${temporaryPassword}</code></li>
          </ul>
          <p>Please log in and change this password immediately.</p>
        `,
      });
    } catch (error) {
      console.error("Failed to send new-user credentials email:", error);
    }

    if (this.config.get("NODE_ENV") !== "production") {
      console.log(
        `[EXAF PLATFORM] New user ${user.email} created by ${actor.email}`,
      );
      console.log(`[EXAF PLATFORM] Temporary password: ${temporaryPassword}`);
    }

    await this.activities.logActivity({
      userId: actor.id,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      description: `User account created for ${user.email} with roles: ${dto.roleNames.join(", ")}`,
    });

    await this.notifications.createNotification({
      userId: user.id,
      title: "Welcome to EXAF Staff Platform",
      message:
        "Your staff account has been created. Please complete your profile and change your temporary password.",
      type: "SYSTEM",
      link: "/users/me",
    });

    return user;
  }

  async findAll() {
    const cached = await this.redis.get<unknown>(CacheKeys.usersDirectory);
    if (cached) return cached;

    const users = await this.prisma.user.findMany({
      select: directorySelect,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const formattedUsers = users.map(formatUserPermissions);

    const ttl = Number(this.config.get("CACHE_TTL_SECONDS", 60));
    await this.redis.set(CacheKeys.usersDirectory, formattedUsers, ttl);
    return formattedUsers;
  }

  async findDirectoryEmails() {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return users;
  }

  async findMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: meSelect,
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updateMe(id: string, dto: UpdateMeInput) {
    if (dto.username !== undefined && dto.username !== null) {
      await this.ensureUsernameAvailable(dto.username, id);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        middleName: dto.middleName === undefined ? undefined : dto.middleName,
        username: dto.username === undefined ? undefined : dto.username,
        dateOfBirth:
          dto.dateOfBirth === undefined
            ? undefined
            : dto.dateOfBirth === null
              ? null
              : new Date(dto.dateOfBirth),
        bio: dto.bio === undefined ? undefined : dto.bio,
      },
      select: meSelect,
    });
    await this.redis.del(CacheKeys.usersDirectory);
    return user;
  }

  async adminUpdate(id: string, dto: AdminUpdateUserInput, actor: AuthUser) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("User not found");

    if (dto.username !== undefined && dto.username !== null) {
      await this.ensureUsernameAvailable(dto.username, id);
    }

    let roleConnect: { roleId: string }[] | undefined;
    if (dto.roleNames) {
      const roles = await this.resolveRoles(dto.roleNames);
      this.ensureRoleAssignmentAllowed(
        actor,
        roles.map((role) => role.name),
      );
      roleConnect = roles.map((role) => ({ roleId: role.id }));
    }

    const user = await this.prisma.$transaction(async (tx) => {
      if (roleConnect) {
        await tx.userRole.deleteMany({ where: { userId: id } });
      }

      return tx.user.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          middleName: dto.middleName === undefined ? undefined : dto.middleName,
          username: dto.username === undefined ? undefined : dto.username,
          department: dto.department,
          officeBranch: dto.officeBranch,
          shift: dto.shift,
          position: dto.position,
          isIntern: dto.isIntern,
          dateOfBirth:
            dto.dateOfBirth === undefined
              ? undefined
              : dto.dateOfBirth === null
                ? null
                : new Date(dto.dateOfBirth),
          bio: dto.bio === undefined ? undefined : dto.bio,
          roles: roleConnect ? { create: roleConnect } : undefined,
        },
        select: meSelect,
      });
    });

    await this.redis.del(CacheKeys.usersDirectory);
    return user;
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Image file is required");
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        "Avatar must be a JPEG, PNG, or WebP image",
      );
    }

    const { url: avatarUrl } = await this.storage.upload(file, "avatars");
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: meSelect,
    });
    await this.redis.del(CacheKeys.usersDirectory);
    return user;
  }

  async deactivate(id: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: meSelect,
    });

    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    await this.redis.del(CacheKeys.usersDirectory);

    this.eventsGateway.notifyForceLogout(id, "ACCOUNT_DEACTIVATED");

    return user;
  }

  async resetPassword(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.id === adminId) {
      throw new BadRequestException(
        "Use the change password endpoint to change your own password",
      );
    }

    const temporaryPassword = crypto.randomBytes(12).toString("base64url");

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: true,
        },
      }),

      this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    this.eventsGateway.notifyForceLogout(userId, "PASSWORD_RESET");

    await this.activities.logActivity({
      userId: adminId,
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: userId,
      description: `Password reset for ${user.email}`,
    });

    await this.notifications.createNotification({
      userId,
      title: "Password Reset",
      message:
        "Your password has been reset by an administrator. Please use the temporary password provided to you and change it immediately after logging in.",
      type: "SECURITY",
    });

    await this.mail.send({
      to: [user.email],
      subject: "EXAF Staff Platform - Password Reset",
      html: `
      <h2>Password Reset</h2>
      <p>Hello ${user.firstName},</p>
      <p>
        Your EXAF Staff Platform password has been reset by an administrator.
      </p>

      <p><strong>Temporary Password:</strong></p>
      <p>
        <code>${temporaryPassword}</code>
      </p>

      <p>
        Please log in using this temporary password and change your password
        immediately.
      </p>
    `,
    });

    if (this.config.get("NODE_ENV") !== "production") {
      console.log("\n======================================================");
      console.log("[EXAF PLATFORM] PASSWORD RESET");
      console.log(`User: ${user.email}`);
      console.log(`Temporary Password: ${temporaryPassword}`);
      console.log("======================================================\n");
    }

    return null;
  }

  private async resolveRoles(roleNames: string[]) {
    const normalized = [
      ...new Set(roleNames.map((name) => name.trim().toUpperCase())),
    ];
    const roles = await this.prisma.role.findMany({
      where: { name: { in: normalized } },
    });
    if (roles.length !== normalized.length) {
      const found = new Set(roles.map((role) => role.name));
      const missing = normalized.filter((role) => !found.has(role));
      throw new BadRequestException(`Unknown role(s): ${missing.join(", ")}`);
    }
    return roles;
  }

  private ensureRoleAssignmentAllowed(actor: AuthUser, roleNames: string[]) {
    if (actor.roles.includes("SUPERADMIN")) return;

    if (!actor.permissions.includes(roleAssignmentPermission)) {
      throw new ForbiddenException(
        "You are not allowed to assign roles when creating a user",
      );
    }

    const restricted = roleNames.filter((role) => privilegedRoles.has(role));
    if (restricted.length) {
      throw new ForbiddenException(
        `Only SUPERADMIN can assign privileged role(s): ${restricted.join(", ")}`,
      );
    }
  }

  async setAttendanceExemption(id: string, exempt: boolean, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    const updated = await this.prisma.user.update({
      where: { id },
      data: { attendanceExempt: exempt },
      select: directorySelect,
    });

    await this.activities.logActivity({
      userId: actorId,
      action: "ATTENDANCE_EXEMPTION_UPDATED",
      entityType: "User",
      entityId: id,
      description: `${exempt ? "Exempted" : "Un-exempted"} ${user.email} from daily attendance tracking`,
    });

    return updated;
  }

  async setPermissionOverrides(
    userId: string,
    dto: SetUserPermissionsInput,
    actor: AuthUser,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException("User not found");

    const allKeys = [...new Set([...dto.grant, ...dto.revoke])];
    const permissions = allKeys.length
      ? await this.prisma.permission.findMany({
          where: { key: { in: allKeys } },
        })
      : [];
    const foundKeys = new Set(permissions.map((p) => p.key));
    const unknown = allKeys.filter((key) => !foundKeys.has(key));
    if (unknown.length) {
      throw new BadRequestException(
        `Unknown permission key(s): ${unknown.join(", ")}`,
      );
    }

    const notOwned = dto.grant.filter(
      (key) => !actor.permissions.includes(key),
    );
    if (notOwned.length && !actor.roles.includes("SUPERADMIN")) {
      throw new ForbiddenException(
        `You cannot grant permission(s) you don't hold yourself: ${notOwned.join(", ")}`,
      );
    }

    const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

    await this.prisma.userPermission.deleteMany({ where: { userId } });
    const rows = [
      ...dto.grant.map((key) => ({
        userId,
        permissionId: permissionIdByKey.get(key)!,
        granted: true,
        grantedById: actor.id,
      })),
      ...dto.revoke.map((key) => ({
        userId,
        permissionId: permissionIdByKey.get(key)!,
        granted: false,
        grantedById: actor.id,
      })),
    ];
    if (rows.length)
      await this.prisma.userPermission.createMany({ data: rows });

    await this.activities.logActivity({
      userId: actor.id,
      action: "USER_PERMISSIONS_UPDATED",
      entityType: "User",
      entityId: userId,
      description: `Set permission overrides for ${target.email}: grant [${dto.grant.join(", ")}], revoke [${dto.revoke.join(", ")}]`,
    });

    await this.redis.del(CacheKeys.usersDirectory);

    this.eventsGateway.notifyPermissionUpdate(userId, {
      permissionGrants: dto.grant,
      permissionRevokes: dto.revoke,
    });

    return {
      userId,
      permissionGrants: dto.grant,
      permissionRevokes: dto.revoke,
    };
  }

  private async ensureUsernameAvailable(
    username: string | null | undefined,
    userId?: string,
  ) {
    if (!username) return;
    const taken = await this.prisma.user.findFirst({
      where: { username, NOT: userId ? { id: userId } : undefined },
    });
    if (taken) throw new ConflictException("Username is already taken");
  }
}
