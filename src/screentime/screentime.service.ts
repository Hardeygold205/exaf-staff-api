import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { LogScreentimeInput, QueryScreentimeInput } from "./screentime.schemas";
import { isTrackingAllowed, isBreakTime } from "../attendance/wat.util";

@Injectable()
export class ScreentimeService {
  constructor(private prisma: PrismaService) {}

  private truncateToDate(d?: string | Date): Date {
    const dateObj = d ? new Date(d) : new Date();
    dateObj.setUTCHours(0, 0, 0, 0);
    return dateObj;
  }

  async logScreentime(userId: string, dto: LogScreentimeInput) {
    const now = new Date();

    if (!isTrackingAllowed(now)) {
      if (isBreakTime(now)) {
        throw new BadRequestException(
          "Screentime tracking is paused from 1:00 PM to 2:00 PM WAT.",
        );
      }

      throw new BadRequestException(
        "Screentime tracking is only accepted during official tracking hours: 9:00 AM to 1:00 PM and 2:00 PM to 6:00 PM WAT.",
      );
    }

    const targetDate = this.truncateToDate(dto.date);

    const currentDate = this.truncateToDate();
    if (targetDate.getTime() !== currentDate.getTime()) {
      throw new BadRequestException(
        "Screentime can only be recorded for the current working day.",
      );
    }

    return this.prisma.screentimeLog.upsert({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
      update: {
        activeSeconds: dto.activeSeconds,
        idleSeconds: dto.idleSeconds,
        deviceInfo: dto.deviceInfo,
        topApps: dto.topApps ?? [],
      },
      create: {
        userId,
        date: targetDate,
        deviceInfo: dto.deviceInfo,
        activeSeconds: dto.activeSeconds,
        idleSeconds: dto.idleSeconds,
        topApps: dto.topApps ?? [],
      },
    });
  }

  findOwnScreentime(userId: string, startDate?: string, endDate?: string) {
    const where: any = { userId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = this.truncateToDate(startDate);
      if (endDate) where.date.lte = this.truncateToDate(endDate);
    }

    return this.prisma.screentimeLog.findMany({
      where,
      orderBy: { date: "desc" },
      take: 60,
    });
  }

  findAllScreentime(query: QueryScreentimeInput) {
    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate)
        where.date.gte = this.truncateToDate(query.startDate);
      if (query.endDate) where.date.lte = this.truncateToDate(query.endDate);
    }

    return this.prisma.screentimeLog.findMany({
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
      orderBy: { date: "desc" },
      take: 200,
    });
  }
}
