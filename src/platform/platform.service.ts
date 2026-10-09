import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../infra/prisma/prisma.service";
import {
  PlatformActivityQuery,
  PlatformListQuery,
  PlatformSignupsQuery,
} from "./platform.schemas";

function sinceDays(days: number) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);
  return since;
}

function mimeBucket(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  ) {
    return "spreadsheet";
  }
  if (mimeType.startsWith("text/") || mimeType.includes("word") || mimeType.includes("document")) {
    return "document";
  }
  return "other";
}

@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

  session(email: string) {
    return { email, isPlatformAdmin: true };
  }

  async overview() {
    const week = sinceDays(7);
    const month = sinceDays(30);
    const [
      organizations,
      activeOrganizations,
      signups7d,
      signups30d,
      staff,
      activeStaff,
      storage,
      projects,
      tasks,
      departments,
      branches,
      pendingInvitations,
      mimeRows,
      signupRows,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { isActive: true } }),
      this.prisma.organization.count({ where: { createdAt: { gte: week } } }),
      this.prisma.organization.count({ where: { createdAt: { gte: month } } }),
      this.prisma.user.count({
        where: { organizationId: { not: null }, isPlatformAdmin: false },
      }),
      this.prisma.user.count({
        where: { organizationId: { not: null }, isActive: true, isPlatformAdmin: false },
      }),
      this.prisma.upload.aggregate({
        _count: { _all: true },
        _sum: { sizeBytes: true },
      }),
      this.prisma.project.count(),
      this.prisma.task.count(),
      this.prisma.department.count(),
      this.prisma.officeBranch.count(),
      this.prisma.invitation.count({ where: { status: "PENDING" } }),
      this.prisma.upload.groupBy({
        by: ["mimeType"],
        _count: { _all: true },
        _sum: { sizeBytes: true },
      }),
      this.prisma.$queryRaw<{ day: Date; count: number }[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
        FROM organizations
        WHERE "createdAt" >= ${month}
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    return {
      organizations: {
        total: organizations,
        active: activeOrganizations,
        suspended: organizations - activeOrganizations,
        signupsLast7Days: signups7d,
        signupsLast30Days: signups30d,
      },
      staff: { total: staff, active: activeStaff },
      documents: {
        count: storage._count._all,
        sizeBytes: storage._sum.sizeBytes ?? 0,
        byType: this.bucketMime(mimeRows),
      },
      projects,
      tasks,
      departments,
      branches,
      pendingInvitations,
      signupsByDay: signupRows.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        count: Number(row.count),
      })),
    };
  }

  async listOrganizations(query: PlatformListQuery) {
    const where = this.orgWhere(query.search, query.status);
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
        select: this.orgSelect(),
      }),
    ]);
    const items = await this.withUsage(rows);
    return { items, meta: this.meta(total, query.page, query.limit) };
  }

  async organization(id: string) {
    const row = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        ...this.orgSelect(),
        legalName: true,
        phone: true,
        website: true,
        timezone: true,
        address: true,
        state: true,
        registrationNumber: true,
        about: true,
        logoUrl: true,
        iconUrl: true,
      },
    });
    if (!row) throw new NotFoundException("Organization not found");

    const month = sinceDays(30);
    const [usage] = await this.withUsage([row]);
    const [actions, storageTypes] = await Promise.all([
      this.prisma.activityLog.groupBy({
        by: ["action"],
        where: { organizationId: id, createdAt: { gte: month } },
        _count: { _all: true },
      }),
      this.prisma.upload.groupBy({
        by: ["mimeType"],
        where: { organizationId: id },
        _count: { _all: true },
        _sum: { sizeBytes: true },
      }),
    ]);

    return {
      ...usage,
      documentsByType: this.bucketMime(storageTypes),
      activityLast30Days: actions
        .map((row) => ({ action: row.action, count: row._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async signups(query: PlatformSignupsQuery) {
    const since = sinceDays(query.days);
    const where: Prisma.OrganizationWhereInput = { createdAt: { gte: since } };
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
        select: this.orgSelect(),
      }),
    ]);
    return {
      items: await this.withUsage(rows),
      meta: this.meta(total, query.page, query.limit),
    };
  }

  async activity(query: PlatformActivityQuery) {
    const where: Prisma.ActivityLogWhereInput = {};
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.action) where.action = query.action;
    const skip = (query.page - 1) * query.limit;
    const [total, items] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
        select: {
          id: true,
          action: true,
          entityType: true,
          description: true,
          createdAt: true,
          organization: { select: { id: true, name: true, slug: true } },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isPlatformAdmin: true,
            },
          },
        },
      }),
    ]);
    return { items, meta: this.meta(total, query.page, query.limit) };
  }

  private orgWhere(search?: string, status: PlatformListQuery["status"] = "all") {
    const where: Prisma.OrganizationWhereInput = {};
    if (status === "active") where.isActive = true;
    if (status === "suspended") where.isActive = false;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { industry: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
      ];
    }
    return where;
  }

  private orgSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      industry: true,
      country: true,
      city: true,
      staffRange: true,
      isActive: true,
      createdAt: true,
      settings: { select: { plan: true, seatLimit: true } },
      users: {
        where: {
          isPlatformAdmin: false,
          roles: { some: { role: { name: "ORG_OWNER" } } },
        },
        select: { email: true, firstName: true, lastName: true, createdAt: true },
        take: 1,
      },
      _count: {
        select: {
          users: true,
          departments: true,
          branches: true,
          projects: true,
          uploads: true,
          invitations: true,
        },
      },
    } satisfies Prisma.OrganizationSelect;
  }

  private async withUsage<
    T extends {
      id: string;
      settings: { plan: string; seatLimit: number } | null;
      users: { email: string; firstName: string; lastName: string; createdAt: Date }[];
      _count: {
        users: number;
        departments: number;
        branches: number;
        projects: number;
        uploads: number;
        invitations: number;
      };
    },
  >(rows: T[]) {
    const ids = rows.map((row) => row.id);
    if (ids.length === 0) return [];
    const [storage, activeStaff, pendingInvites] = await Promise.all([
      this.prisma.upload.groupBy({
        by: ["organizationId"],
        where: { organizationId: { in: ids } },
        _sum: { sizeBytes: true },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ["organizationId"],
        where: { organizationId: { in: ids }, isActive: true, isPlatformAdmin: false },
        _count: { _all: true },
      }),
      this.prisma.invitation.groupBy({
        by: ["organizationId"],
        where: { organizationId: { in: ids }, status: "PENDING" },
        _count: { _all: true },
      }),
    ]);
    const storageById = new Map(storage.map((row) => [row.organizationId, row]));
    const activeById = new Map(
      activeStaff.map((row) => [row.organizationId, row._count._all]),
    );
    const pendingById = new Map(
      pendingInvites.map((row) => [row.organizationId, row._count._all]),
    );

    return rows.map((row) => {
      const stored = storageById.get(row.id);
      const seatLimit = row.settings?.seatLimit ?? 0;
      const staffCount = row._count.users;
      const { users, _count, settings, ...profile } = row;
      return {
        ...profile,
        plan: settings?.plan ?? "FREE",
        seatLimit,
        owner: users[0] ?? null,
        staffCount,
        activeStaffCount: activeById.get(row.id) ?? 0,
        seatsUsedPercent: seatLimit > 0 ? Math.round((staffCount / seatLimit) * 100) : null,
        overSeatLimit: seatLimit > 0 && staffCount > seatLimit,
        departmentCount: _count.departments,
        branchCount: _count.branches,
        projectCount: _count.projects,
        documentCount: stored?._count._all ?? _count.uploads,
        storageBytes: stored?._sum.sizeBytes ?? 0,
        invitationCount: _count.invitations,
        pendingInvitationCount: pendingById.get(row.id) ?? 0,
      };
    });
  }

  private bucketMime(
    rows: { mimeType: string; _count: { _all: number }; _sum: { sizeBytes: number | null } }[],
  ) {
    const buckets = new Map<string, { count: number; sizeBytes: number }>();
    for (const row of rows) {
      const key = mimeBucket(row.mimeType);
      const current = buckets.get(key) ?? { count: 0, sizeBytes: 0 };
      current.count += row._count._all;
      current.sizeBytes += row._sum.sizeBytes ?? 0;
      buckets.set(key, current);
    }
    return [...buckets.entries()]
      .map(([type, value]) => ({ type, ...value }))
      .sort((a, b) => b.sizeBytes - a.sizeBytes);
  }

  private meta(total: number, page: number, limit: number) {
    return { total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
