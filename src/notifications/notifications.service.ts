import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { QueryNotificationsInput } from "./notifications.schemas";

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createNotification(data: {
    userId: string;
    title: string;
    message: string;
    type: string;
    link?: string;
  }) {
    try {
      return await this.prisma.notification.create({
        data: {
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.type,
          link: data.link,
        },
      });
    } catch (error) {
      console.error("Failed to create notification:", error);
    }
  }

  async createBulkNotifications(
    userIds: string[],
    data: { title: string; message: string; type: string; link?: string },
  ) {
    if (!userIds.length) return;
    try {
      const records = userIds.map((userId) => ({
        userId,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link,
      }));
      return await this.prisma.notification.createMany({ data: records });
    } catch (error) {
      console.error("Failed to create bulk notifications:", error);
    }
  }

  async findOwnNotifications(userId: string, query: QueryNotificationsInput) {
    const { isRead, page = 1, limit = 20 } = query;
    const where: any = { userId };
    if (isRead !== undefined) where.isRead = isRead;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
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

  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundException("Notification not found");

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return null;
  }
}
