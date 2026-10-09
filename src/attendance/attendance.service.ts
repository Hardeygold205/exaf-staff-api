import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { CheckInInput, CheckOutInput } from "./attendance.schemas";
import {
  CHECKOUT_REASON_OPTIONS,
  isAfterCheckoutGrace,
  isBeforeOfficialEnd,
  isCheckInAllowed,
  isCheckoutGracePeriod,
  isEarlyCheckOut,
} from "./wat.util";

import { ActivitiesService } from "../activities/activities.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private activities: ActivitiesService,
    private notifications: NotificationsService,
  ) {}

  checkoutReasons() {
    return CHECKOUT_REASON_OPTIONS;
  }

  async checkIn(userId: string, dto: CheckInInput, ip?: string) {
    const now = new Date();

    if (!isCheckInAllowed(now)) {
      throw new BadRequestException("Check-in opens at 8:00 AM WAT.");
    }

    const openRecord = await this.prisma.attendance.findFirst({
      where: { userId, checkOutAt: null },
    });

    if (openRecord) {
      const openRecordDate = new Date(openRecord.checkInAt);
      const getWatDateString = (d: Date) => new Date(d.getTime() + 3600000).toISOString().split('T')[0];
      const isSameDay = getWatDateString(openRecordDate) === getWatDateString(now);
      if (isSameDay) {
        throw new BadRequestException(
          "You already have an open check-in. Check out first.",
        );
      } else {
        const endOfThatDay = new Date(openRecordDate);
        endOfThatDay.setUTCHours(22, 59, 59, 999);
        await this.prisma.attendance.update({
          where: { id: openRecord.id },
          data: {
            checkOutAt: endOfThatDay,
            leftEarly: true,
            reviewStatus: "PENDING_REVIEW",
            checkoutReasonType: "FORGOT_TO_CHECKOUT",
            checkoutSource: "SYSTEM",
          }
        });
      }
    }

    const status = "PRESENT";

    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!account?.organizationId) {
      throw new BadRequestException("Attendance requires an organization account");
    }
    const record = await this.prisma.attendance.create({
      data: {
        organizationId: account.organizationId,
        userId,
        checkInAt: now,
        checkInIp: ip,
        checkInLat: dto.lat,
        checkInLng: dto.lng,
        status,
      },
    });

    await this.activities.logActivity({
      userId,
      action: "ATTENDANCE_CHECKIN",
      entityType: "Attendance",
      entityId: record.id,
      description: `Checked in at ${now.toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos" })} WAT (${status})`,
      ipAddress: ip,
    });

    await this.notifications.createNotification({
      userId,
      title: "Attendance Check-in",
      message: `You successfully checked in at ${now.toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos" })} WAT (${status}).`,
      type: "ATTENDANCE_ALERT",
      link: "/attendance/me",
    });

    return record;
  }

  async checkOut(userId: string, dto: CheckOutInput, ip?: string) {
    const openRecord = await this.prisma.attendance.findFirst({
      where: { userId, checkOutAt: null },
      orderBy: { checkInAt: "desc" },
    });

    if (!openRecord) {
      throw new BadRequestException("No open check-in found.");
    }

    const now = new Date();
    const beforeOfficialEnd = isBeforeOfficialEnd(now);
    const afterGrace = isAfterCheckoutGrace(now);

    if ((beforeOfficialEnd || afterGrace) && !dto.reasonType) {
      throw new BadRequestException(
        beforeOfficialEnd
          ? "A reason is required when checking out before 5:00 PM WAT."
          : "A reason is required when checking out after 6:00 PM WAT.",
      );
    }

    if (dto.reasonType === "OTHER" && !dto.reasonText?.trim()) {
      throw new BadRequestException(
        "Please provide your reason when selecting Other.",
      );
    }

    if (dto.reasonType !== "OTHER" && dto.reasonText?.trim()) {
      throw new BadRequestException("Reason text is only required for Other.");
    }

    const reviewRequired = beforeOfficialEnd || afterGrace;

    const record = await this.prisma.attendance.update({
      where: { id: openRecord.id },
      data: {
        checkOutAt: now,
        checkOutIp: ip,
        checkOutLat: dto.lat,
        checkOutLng: dto.lng,
        leftEarly: isEarlyCheckOut(now),
        reviewStatus: reviewRequired ? "PENDING_REVIEW" : "NONE",
        checkoutReasonType: dto.reasonType,
        checkoutReasonText:
          dto.reasonType === "OTHER" ? dto.reasonText?.trim() : null,
      },
    });

    await this.activities.logActivity({
      userId,
      action: "ATTENDANCE_CHECKOUT",
      entityType: "Attendance",
      entityId: record.id,
      description: `Checked out at ${now.toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos" })} WAT${beforeOfficialEnd ? " (Left Early)" : afterGrace ? " (Late Checkout)" : ""}`,
      ipAddress: ip,
    });

    await this.notifications.createNotification({
      userId,
      title: "Attendance Check-out",
      message: `You successfully checked out at ${now.toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos" })} WAT.`,
      type: "ATTENDANCE_ALERT",
      link: "/attendance/me",
    });

    return record;
  }

  findOwn(userId: string) {
    return this.prisma.attendance.findMany({
      where: { userId },
      orderBy: { checkInAt: "desc" },
      take: 90,
    });
  }

  findAll(organizationId: string) {
    return this.prisma.attendance.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, attendanceExempt: true },
        },
      },
      orderBy: { checkInAt: "desc" },
      take: 200,
    });
  }

  findPendingReview() {
    return this.prisma.attendance.findMany({
      where: { reviewStatus: "PENDING_REVIEW" },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, attendanceExempt: true },
        },
      },
      orderBy: { checkInAt: "asc" },
    });
  }

  async review(id: string, reviewerId: string, dto: { note?: string }) {
    const record = await this.prisma.attendance.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Attendance record not found");
    if (record.reviewStatus !== "PENDING_REVIEW") {
      throw new BadRequestException("This record is not awaiting review");
    }

    const updated = await this.prisma.attendance.update({
      where: { id },
      data: {
        reviewStatus: "REVIEWED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: dto.note,
      },
    });

    await this.activities.logActivity({
      userId: reviewerId,
      action: "ATTENDANCE_REVIEWED",
      entityType: "Attendance",
      entityId: id,
      description: `Reviewed ${record.userId === reviewerId ? "own" : "a staff member's"} attendance record${dto.note ? `: ${dto.note}` : ""}`,
    });

    await this.notifications.createNotification({
      userId: record.userId,
      title: "Attendance Reviewed",
      message: "Your flagged check-in/check-out has been reviewed.",
      type: "ATTENDANCE_ALERT",
      link: "/attendance/me",
    });

    return updated;
  }
}
