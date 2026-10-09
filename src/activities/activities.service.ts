import { Injectable } from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { QueryActivitiesInput } from "./activities.schemas";

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async logActivity(data: {
    userId?: string;
    organizationId?: string;
    action: string;
    description: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
  }) {
    try {
      let organizationId = data.organizationId;
      if (!organizationId && data.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: data.userId },
          select: { organizationId: true },
        });
        organizationId = user?.organizationId ?? undefined;
      }
      return await this.prisma.activityLog.create({
        data: {
          userId: data.userId,
          organizationId,
          action: data.action,
          description: data.description,
          entityType: data.entityType,
          entityId: data.entityId,
          metadata: data.metadata ?? {},
          ipAddress: data.ipAddress,
        },
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  }

  async findOwnActivities(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where: { userId } }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllActivities(query: QueryActivitiesInput, organizationId?: string) {
    const {
      userId,
      action,
      entityType,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
