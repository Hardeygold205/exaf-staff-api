import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../infra/prisma/prisma.service";
import { ActivitiesService } from "../activities/activities.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../infra/mail/mail.service";
import { isEarlyCheckOut } from "./wat.util";

@Injectable()
export class AttendanceAutoCheckoutService {
  private readonly logger = new Logger(AttendanceAutoCheckoutService.name);

  constructor(
    private prisma: PrismaService,
    private activities: ActivitiesService,
    private notifications: NotificationsService,
    private mail: MailService,
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

  @Cron("30 18 * * 1-5", { timeZone: "Africa/Lagos" })
  async checkoutReminder() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const openRecords = await this.prisma.attendance.findMany({
      where: {
        checkOutAt: null,
        checkInAt: { gte: todayStart },
      },
      include: {
        user: { include: { organization: { select: { name: true } } } },
      },
    });

    for (const record of openRecords) {
      if (!record.user.email || !record.user.organizationId) continue;
      await this.mail.send({
        to: [record.user.email],
        organizationName: record.user.organization?.name,
        subject: "Reminder: please check out",
        html: `<p>Hi ${record.user.firstName},</p><p>It's past 6:30 PM WAT and you haven't checked out yet. Please remember to check out for the day.</p>`,
      });
    }
    this.logger.log(`Sent check-out reminders to ${openRecords.length} users`);
  }

  @Cron("30 9 * * 1-5", { timeZone: "Africa/Lagos" })
  async checkInReminder() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const activeUsers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        attendanceExempt: false,
        organizationId: { not: null },
      },
      include: { organization: { select: { name: true } } },
    });

    let sentCount = 0;
    for (const user of activeUsers) {
      const attendance = await this.prisma.attendance.findFirst({
        where: {
          userId: user.id,
          checkInAt: { gte: todayStart },
        },
      });

      if (!attendance) {
        await this.mail.send({
          to: [user.email],
          organizationName: user.organization?.name,
          subject: "Reminder: please check in",
          html: `<p>Hi ${user.firstName},</p><p>It's 9:30 AM WAT and you haven't checked in yet. Please remember to check in if you are working today.</p>`,
        });
        sentCount++;
      }
    }
    this.logger.log(`Sent check-in reminders to ${sentCount} users`);
  }
}
