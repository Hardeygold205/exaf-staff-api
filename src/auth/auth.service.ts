import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { PrismaService } from "../infra/prisma/prisma.service";
import { RedisService } from "../infra/redis/redis.service";
import { CacheKeys } from "../common/cache-keys";
import { ChangePasswordInput, LoginInput } from "./auth.schemas";

import { ActivitiesService } from "../activities/activities.service";
import { NotificationsService } from "../notifications/notifications.service";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private redis: RedisService,
    private activities: ActivitiesService,
    private notifications: NotificationsService,
  ) {}

  private async loadRolesAndPermissions(userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    const roles = userRoles.map((ur) => ur.role.name);
    const permissions = new Set<string>();
    const missing: string[] = [];

    for (const userRole of userRoles) {
      const cached = await this.redis.get<string[]>(
        CacheKeys.rolePermissions(userRole.roleId),
      );
      if (cached) {
        cached.forEach((key) => permissions.add(key));
      } else {
        missing.push(userRole.roleId);
      }
    }

    if (missing.length) {
      const ttl = Number(this.config.get("CACHE_RBAC_TTL_SECONDS", 3600));
      const dbRoles = await this.prisma.role.findMany({
        where: { id: { in: missing } },
        include: { permissions: { include: { permission: true } } },
      });
      for (const role of dbRoles) {
        const keys = role.permissions.map((rp) => rp.permission.key);
        await this.redis.set(CacheKeys.rolePermissions(role.id), keys, ttl);
        keys.forEach((key) => permissions.add(key));
      }
    }

    const overrides = await this.prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });
    for (const override of overrides) {
      if (override.granted) permissions.add(override.permission.key);
      else permissions.delete(override.permission.key);
    }

    return { roles, permissions: Array.from(permissions) };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return user;
  }

  async login(
    dto: LoginInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const user = await this.validateUser(dto.email, dto.password);
    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.mustChangePassword,
      ipAddress,
      userAgent,
    );

    await this.activities.logActivity({
      userId: user.id,
      action: "USER_LOGIN",
      description: `User logged in from IP ${ipAddress ?? "unknown"}`,
      ipAddress,
    });

    return tokens;
  }

  async changePassword(userId: string, dto: ChangePasswordInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException("User not found");
    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches)
      throw new UnauthorizedException("Current password is incorrect");

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    await this.activities.logActivity({
      userId,
      action: "PASSWORD_CHANGED",
      description: "Account password changed successfully",
    });

    await this.notifications.createNotification({
      userId,
      title: "Security Alert",
      message: "Your account password was successfully updated.",
      type: "SECURITY",
    });

    return null;
  }

  async refresh(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const matched = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!matched)
      throw new UnauthorizedException("Invalid or expired refresh token");

    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: matched.userId },
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException("Account disabled");

    return this.issueTokens(
      user.id,
      user.email,
      user.mustChangePassword,
      ipAddress,
      userAgent,
    );
  }

  async logout(userId: string, jti: string, exp: number) {
    const expiresIn = Math.max(0, exp - Math.floor(Date.now() / 1000));
    if (expiresIn > 0) {
      await this.redis.blacklistAccessToken(jti, expiresIn);
    }

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return null;
  }

  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Account is inactive");
    }
    return this.issueTokens(
      user.id,
      user.email,
      user.mustChangePassword,
      ipAddress,
      userAgent,
    );
  }

  private hashRefreshToken(rawToken: string): string {

    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }

  private async issueTokens(
    userId: string,
    email: string,
    mustChangePassword: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const { roles, permissions } = await this.loadRolesAndPermissions(userId);

    const secret = this.config.get<string>("JWT_ACCESS_SECRET");
    if (!secret) throw new Error("JWT_ACCESS_SECRET is not set");

    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, isPlatformAdmin: true, isActive: true },
    });
    if (!account?.isActive) {
      throw new UnauthorizedException("Account is inactive");
    }
    if (account.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: account.organizationId },
        select: { isActive: true },
      });
      if (!org?.isActive) {
        throw new UnauthorizedException("Organization is suspended");
      }
    }

    const accessToken = this.jwt.sign(
      {
        sub: userId,
        email,
        orgId: account.organizationId,
        isPlatformAdmin: account.isPlatformAdmin,
        roles,
        permissions,
        jti: crypto.randomUUID(),
      },
      {
        secret,
        expiresIn: this.config.get("JWT_ACCESS_EXPIRES_IN", "15m"),
      },
    );

    const refreshToken = crypto.randomBytes(48).toString("hex");
    const tokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = this.parseExpiryToDate(
      this.config.get("JWT_REFRESH_EXPIRES_IN", "7d"),
    );

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, ipAddress, userAgent, expiresAt },
    });

    return { accessToken, refreshToken, mustChangePassword };
  }

  private parseExpiryToDate(expiry: string): Date {
    const cleanExpiry = expiry.replace(/['"]/g, "").trim();

    const match = /^(\d+)([smhd])$/.exec(cleanExpiry);
    const now = new Date();

    if (!match) {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = Number(match[1]);
    const unitMs =
      { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]] ??
      86_400_000;

    return new Date(now.getTime() + value * unitMs);
  }
}
