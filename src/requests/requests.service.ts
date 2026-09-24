import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { MailService } from "../infra/mail/mail.service";
import { CreateRequestInput, ReviewRequestInput } from "./requests.schemas";
import { REQUEST_CATEGORIES } from "./request-categories";
import { ActivitiesService } from "../activities/activities.service";
import { NotificationsService } from "../notifications/notifications.service";
import { escapeHtml } from "../common/escape-html.util";

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private activities: ActivitiesService,
    private notifications: NotificationsService,
  ) {}

  categories() {
    return REQUEST_CATEGORIES;
  }

  async create(userId: string, dto: CreateRequestInput) {
    const request = await this.prisma.staffRequest.create({
      data: {
        userId,
        category: dto.category,
        subject: dto.subject,
        details: dto.details,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notifyToEmails: dto.notifyToEmails,
        notifyCcEmails: dto.notifyCcEmails,
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (dto.notifyToEmails.length) {
      const requester = `${request.user.firstName} ${request.user.lastName}`;
      await this.mail.send({
        to: dto.notifyToEmails,
        cc: dto.notifyCcEmails,
        replyTo: request.user.email,
        subject: `[${dto.category}] ${dto.subject}`,
        html: `
          <p>${requester} (${request.user.email}) submitted a <strong>${dto.category}</strong> request.</p>
          <p><strong>Subject:</strong> ${escapeHtml(dto.subject)}</p>
          ${dto.details ? `<p>${escapeHtml(dto.details)}</p>` : ""}
          ${dto.startDate ? `<p>From ${dto.startDate} to ${dto.endDate}</p>` : ""}
        `,
      });
    }

    await this.activities.logActivity({
      userId,
      action: "REQUEST_SUBMITTED",
      entityType: "StaffRequest",
      entityId: request.id,
      description: `Submitted a ${request.category} request: "${request.subject}"`,
    });

    await this.notifications.createNotification({
      userId,
      title: "Request Submitted",
      message: `Your ${request.category} request "${request.subject}" was successfully submitted.`,
      type: "REQUEST_UPDATE",
      link: "/requests/me",
    });

    return request;
  }

  findOwn(userId: string) {
    return this.prisma.staffRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  findAll() {
    return this.prisma.staffRequest.findMany({
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async review(id: string, reviewerId: string, dto: ReviewRequestInput) {
    const request = await this.prisma.staffRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException("Request not found");
    if (request.status !== "PENDING") {
      throw new BadRequestException("This request has already been reviewed");
    }

    const updated = await this.prisma.staffRequest.update({
      where: { id },
      data: {
        status: dto.decision,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });

    await this.activities.logActivity({
      userId: reviewerId,
      action: "REQUEST_REVIEWED",
      entityType: "StaffRequest",
      entityId: id,
      description: `Reviewed request "${request.subject}" -> ${dto.decision}`,
    });

    await this.notifications.createNotification({
      userId: request.userId,
      title: `Request ${dto.decision}`,
      message: `Your ${request.category} request "${request.subject}" was ${dto.decision}.`,
      type: "REQUEST_UPDATE",
      link: "/requests/me",
    });

    return updated;
  }

  async cancel(id: string, userId: string) {
    const request = await this.prisma.staffRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException("Request not found");
    if (request.userId !== userId)
      throw new ForbiddenException("You can only cancel your own requests");
    if (request.status !== "PENDING") {
      throw new BadRequestException("Only pending requests can be cancelled");
    }

    const updated = await this.prisma.staffRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await this.activities.logActivity({
      userId,
      action: "REQUEST_CANCELLED",
      entityType: "StaffRequest",
      entityId: id,
      description: `Cancelled request "${request.subject}"`,
    });

    return updated;
  }
}
