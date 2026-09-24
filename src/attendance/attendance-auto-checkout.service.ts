import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../infra/prisma/prisma.service";
import { ActivitiesService } from "../activities/activities.service";
import { NotificationsService } from "../notifications/notifications.service";
import { isEarlyCheckOut } from "./wat.util";

@Injectable()
export class AttendanceAutoCheckoutService {
  private readonly logger = new Logger(AttendanceAutoCheckoutService.name);

  constructor(
    private prisma: PrismaService,
    private activities: ActivitiesService,
    private notifications: NotificationsService,
  ) {}

  @Cron("59 23 * * *", { timeZone: "Africa/Lagos" })
  async autoCheckoutOpenRecords() {
    const openRecords = await this.prisma.attendance.findMany({
      where: { checkOutAt: null },
    });

    if (!openRecords.length) return;

    const now = new Date();

    for (const record of openRecords) {
      await this.prisma.attendance.update({
        where: { id: record.id },
        data: {
          checkOutAt: now,
          leftEarly: isEarlyCheckOut(now),
          reviewStatus: "PENDING_REVIEW",
          checkoutReasonType: "FORGOT_TO_CHECKOUT",
          checkoutSource: "SYSTEM",
        },
      });

      await this.activities.logActivity({
        userId: record.userId,
        action: "ATTENDANCE_AUTO_CHECKOUT",
        entityType: "Attendance",
        entityId: record.id,
        description: `Automatically checked out at 23:59 WAT — no check-out was recorded for this day.`,
      });

      await this.notifications.createNotification({
        userId: record.userId,
        title: "Automatic Check-out",
        message:
          "You didn't check out today, so the system checked you out at 11:59 PM WAT. Please remember to check out going forward.",
        type: "ATTENDANCE_ALERT",
        link: "/attendance/me",
      });
    }

    this.logger.log(
      `Auto-checked-out ${openRecords.length} open attendance record(s)`,
    );
  }
}
