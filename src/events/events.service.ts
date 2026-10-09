import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { ActivitiesService } from "../activities/activities.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../infra/mail/mail.service";
import { CreateEventInput, UpdateEventInput } from "./events.schemas";
import { escapeHtml } from "../common/escape-html.util";

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private activities: ActivitiesService,
    private notifications: NotificationsService,
    private mail: MailService,
  ) {}

  async create(userId: string, dto: CreateEventInput) {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationId: true,
        organization: { select: { name: true } },
      },
    });
    if (!account?.organizationId) throw new Error("Organization required");
    const organizationName = account.organization?.name;
    const event = await this.prisma.event.create({
      data: {
        organizationId: account.organizationId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        startsAt: new Date(dto.startsAt),
        endsAt:
          dto.endsAt === undefined
            ? undefined
            : dto.endsAt === null
              ? null
              : new Date(dto.endsAt),
        allDay: dto.allDay,
        linkUrl: dto.linkUrl === undefined ? undefined : dto.linkUrl,
        linkLabel: dto.linkLabel === undefined ? undefined : dto.linkLabel,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.activities.logActivity({
      userId,
      action: "EVENT_CREATED",
      entityType: "Event",
      entityId: event.id,
      description: `Event "${event.title}" was created`,
    });

    await this.notifications.createBulkNotifications(
      await this.activeUserIds(account.organizationId),
      {
        title: event.title,
        message:
          event.description ??
          `A new ${event.type.toLowerCase().replace("_", " ")} has been announced.`,
        type: "EVENT",
        link: event.linkUrl ?? `/events/${event.id}`,
      },
    );

    if (dto.notifyByEmail) {
      const staffEmails = await this.activeUserEmails(account.organizationId);
      await this.mail.send({
        to: [],
        bcc: staffEmails,
        replyTo: event.createdBy.email,
        organizationName,
        subject: `[${event.type.replace("_", " ")}] ${event.title}`,
        html: `
          <p>${escapeHtml(event.description ?? event.title)}</p>
          ${event.linkUrl ? `<p><a href="${event.linkUrl}">${escapeHtml(event.linkLabel ?? "View details")}</a></p>` : ""}
        `,
      });
    }

    return event;
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }

  async update(id: string, userId: string, dto: UpdateEventInput) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Event not found");

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt =
      dto.endsAt === undefined
        ? existing.endsAt
        : dto.endsAt === null
          ? null
          : new Date(dto.endsAt);
    const linkUrl = dto.linkUrl === undefined ? existing.linkUrl : dto.linkUrl;
    const linkLabel =
      dto.linkLabel === undefined ? existing.linkLabel : dto.linkLabel;
    if (endsAt && endsAt < startsAt)
      throw new BadRequestException("endsAt cannot be before startsAt");
    if (linkLabel && !linkUrl)
      throw new BadRequestException(
        "linkUrl is required when linkLabel is provided",
      );

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt:
          dto.endsAt === undefined
            ? undefined
            : dto.endsAt === null
              ? null
              : new Date(dto.endsAt),
        allDay: dto.allDay,
        linkUrl: dto.linkUrl === undefined ? undefined : dto.linkUrl,
        linkLabel: dto.linkLabel === undefined ? undefined : dto.linkLabel,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.activities.logActivity({
      userId,
      action: "EVENT_UPDATED",
      entityType: "Event",
      entityId: id,
      description: `Event "${event.title}" was updated`,
    });

    return event;
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Event not found");
    await this.prisma.event.delete({ where: { id } });
    await this.activities.logActivity({
      userId,
      action: "EVENT_DELETED",
      entityType: "Event",
      entityId: id,
      description: `Event "${existing.title}" was deleted`,
    });
    return null;
  }

  async listUpcoming(organizationId: string, days = 30) {
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const birthdayFrom = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const [events, users] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          organizationId,
          OR: [
            { startsAt: { gte: now, lte: end } },
            { startsAt: { lt: now }, endsAt: { gte: now } },
          ],
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { startsAt: "asc" },
      }),
      this.prisma.user.findMany({
        where: { organizationId, isActive: true, dateOfBirth: { not: null } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
        },
      }),
    ]);

    const birthdayEvents = users.flatMap((user) => {
      if (!user.dateOfBirth) return [];
      const birthdays = this.nextBirthdays(user.dateOfBirth, birthdayFrom, end);
      return birthdays.map((date) => ({
        id: `birthday:${user.id}:${date.toISOString().slice(0, 10)}`,
        title: `${user.firstName} ${user.lastName}'s Birthday`,
        description: `Wish ${user.firstName} ${user.lastName} a happy birthday!`,
        type: "BIRTHDAY" as const,
        startsAt: date,
        endsAt: null,
        allDay: true,
        linkUrl: null,
        linkLabel: null,
        createdBy: null,
        isAutomatic: true,
        userId: user.id,
      }));
    });

    return [
      ...events.map((event) => ({ ...event, isAutomatic: false })),
      ...birthdayEvents,
    ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  async listManaged(organizationId: string) {
    return this.prisma.event.findMany({
      where: { organizationId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startsAt: "desc" },
    });
  }

  private nextBirthdays(dateOfBirth: Date, from: Date, to: Date) {
    const result: Date[] = [];
    for (
      let year = from.getUTCFullYear();
      year <= to.getUTCFullYear();
      year++
    ) {
      const month = dateOfBirth.getUTCMonth();
      const day = dateOfBirth.getUTCDate();
      // Treat Feb 29 birthdays as Feb 28 in non-leap years.
      const isLeapDay = month === 1 && day === 29;
      const targetDay = isLeapDay && !this.isLeapYear(year) ? 28 : day;
      const candidate = new Date(Date.UTC(year, month, targetDay));
      if (candidate >= from && candidate <= to) result.push(candidate);
    }
    return result;
  }

  private isLeapYear(year: number) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  private async activeUserIds(organizationId?: string) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, ...(organizationId ? { organizationId } : {}) },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  private async activeUserEmails(organizationId?: string) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, ...(organizationId ? { organizationId } : {}) },
      select: { email: true },
    });
    return users.map((user) => user.email);
  }
}
