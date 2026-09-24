import { Injectable } from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { MonthlyCalendarQuery } from "./calendar.schemas";

type CalendarItem = {
  id: string;
  type: string;
  title: string;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async getMonthlyCalendar(userId: string, query: MonthlyCalendarQuery) {
    const { start, end } = this.monthBounds(query.year, query.month);

    const [events, birthdays, leaveRequests, tasks, projects] =
      await Promise.all([
        this.prisma.event.findMany({
          where: {
            startsAt: { lt: end },
            OR: [{ endsAt: null }, { endsAt: { gte: start } }],
          },
          orderBy: { startsAt: "asc" },
        }),

        this.prisma.user.findMany({
          where: {
            dateOfBirth: { not: null },
            isActive: true,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
          },
        }),

        this.prisma.staffRequest.findMany({
          where: {
            category: "LEAVE",
            status: "APPROVED",
            startDate: { not: null, lt: end },
            endDate: { not: null, gte: start },
          },
          select: {
            id: true,
            userId: true,
            startDate: true,
            endDate: true,
            subject: true,
            user: { select: { firstName: true, lastName: true } },
          },
        }),

        this.prisma.task.findMany({
          where: {
            dueDate: { gte: start, lt: end },
            OR: [{ assigneeId: userId }, { creatorId: userId }],
          },
          select: {
            id: true,
            title: true,
            dueDate: true,
            priority: true,
            status: true,
          },
          orderBy: { dueDate: "asc" },
        }),

        this.prisma.project.findMany({
          where: {
            endDate: { gte: start, lt: end },
            OR: [{ createdById: userId }, { members: { some: { userId } } }],
          },
          select: {
            id: true,
            name: true,
            endDate: true,
            status: true,
          },
          orderBy: { endDate: "asc" },
        }),
      ]);

    const items: CalendarItem[] = [];

    for (const event of events) {
      items.push({
        id: event.id,
        type: event.type,
        title: event.title,
        startDate: event.startsAt.toISOString(),
        endDate: event.endsAt?.toISOString(),
        allDay: event.allDay,
      });
    }

    for (const user of birthdays) {
      if (!user.dateOfBirth) continue;
      const birthday = this.birthdayInMonth(
        user.dateOfBirth,
        query.year,
        query.month,
      );
      if (!birthday) continue;

      items.push({
        id: `birthday:${user.id}:${query.year}`,
        type: "BIRTHDAY",
        title: `${user.firstName} ${user.lastName}'s Birthday`,
        startDate: birthday.toISOString(),
        endDate: birthday.toISOString(),
        allDay: true,
        metadata: {
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    }

    for (const leave of leaveRequests) {
      if (!leave.startDate || !leave.endDate) continue;

      items.push({
        id: leave.id,
        type: "LEAVE",
        title: `${leave.user.firstName} ${leave.user.lastName} • ${leave.subject}`,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        allDay: true,
        metadata: { userId: leave.userId },
      });
    }

    for (const task of tasks) {
      if (!task.dueDate) continue;

      items.push({
        id: task.id,
        type: "TASK_DEADLINE",
        title: task.title,
        startDate: task.dueDate.toISOString(),
        endDate: task.dueDate.toISOString(),
        allDay: true,
        metadata: {
          priority: task.priority,
          status: task.status,
        },
      });
    }

    for (const project of projects) {
      if (!project.endDate) continue;

      items.push({
        id: project.id,
        type: "PROJECT_DEADLINE",
        title: project.name,
        startDate: project.endDate.toISOString(),
        endDate: project.endDate.toISOString(),
        allDay: true,
        metadata: { status: project.status },
      });
    }

    return {
      year: query.year,
      month: query.month,
      timezone: "Africa/Lagos",
      workingHours: {
        checkInFrom: "08:00",
        officialStart: "09:00",
        breakStart: "13:00",
        breakEnd: "14:00",
        officialEnd: "17:00",
        trackingEnd: "18:00",
      },
      workingDays: this.generateWorkingDays(query.year, query.month),
      items: items.sort((a, b) => a.startDate.localeCompare(b.startDate)),
    };
  }

  private monthBounds(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { start, end };
  }

  private generateWorkingDays(year: number, month: number) {
    const days: string[] = [];
    const cursor = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    while (cursor < end) {
      const day = cursor.getUTCDay();
      if (day >= 1 && day <= 5) {
        days.push(cursor.toISOString().slice(0, 10));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
  }

  private birthdayInMonth(dateOfBirth: Date, year: number, month: number) {
    const monthIndex = dateOfBirth.getUTCMonth();
    const day = dateOfBirth.getUTCDate();

    if (monthIndex !== month - 1) return null;

    const candidate = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0));
    if (
      candidate.getUTCMonth() !== monthIndex ||
      candidate.getUTCDate() !== day
    ) {
      return null;
    }

    return candidate;
  }
}
