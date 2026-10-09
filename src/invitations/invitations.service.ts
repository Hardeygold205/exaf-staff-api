import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { PrismaService } from "../infra/prisma/prisma.service";
import { MailService } from "../infra/mail/mail.service";
import { ActivitiesService } from "../activities/activities.service";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { requireOrgId } from "../common/tenant";
import { escapeHtml } from "../common/escape-html.util";
import { CreateInvitationInput } from "./invitations.schemas";

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private activities: ActivitiesService,
  ) {}

  async create(actor: AuthUser, dto: CreateInvitationInput) {
    const organizationId = requireOrgId(actor);
    const email = dto.email.toLowerCase();
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { settings: true },
    });
    this.assertSeat(
      org.settings?.seatLimit,
      await this.prisma.user.count({
        where: { organizationId, isActive: true },
      }),
    );
    this.assertDomain(org.settings?.allowedEmailDomains ?? [], email);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing)
      throw new ConflictException("A user with this email already exists");

    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({
        where: { id: dto.roleId, organizationId },
      });
      if (!role)
        throw new NotFoundException("Role not found in this organization");
    }
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId, isActive: true },
      });
      if (!department)
        throw new NotFoundException(
          "Department not found in this organization",
        );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await this.prisma.invitation.upsert({
      where: { organizationId_email: { organizationId, email } },
      update: {
        roleId: dto.roleId,
        departmentId: dto.departmentId,
        invitedById: actor.id,
        token,
        status: "PENDING",
        expiresAt,
        acceptedAt: null,
      },
      create: {
        organizationId,
        email,
        roleId: dto.roleId,
        departmentId: dto.departmentId,
        invitedById: actor.id,
        token,
        expiresAt,
      },
    });

    try {
      await this.mail.send({
        to: [email],
        organizationName: org.name,
        subject: `You're invited to join`,
        html: `
          <h2>${escapeHtml(org.name)} invited you</h2>
          <p>Use this token to accept the invitation within 7 days:</p>
          <p><code>${token}</code></p>
        `,
      });
    } catch (error) {
      console.error("Failed to send invitation email:", error);
    }

    await this.activities.logActivity({
      userId: actor.id,
      organizationId,
      action: "INVITATION_SENT",
      entityType: "Invitation",
      entityId: invitation.id,
      description: `Invitation sent to ${email}`,
    });

    return { id: invitation.id, email, expiresAt, status: invitation.status };
  }

  findAll(actor: AuthUser) {
    return this.prisma.invitation.findMany({
      where: { organizationId: requireOrgId(actor) },
      orderBy: { createdAt: "desc" },
      include: {
        role: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
  }

  async cancel(actor: AuthUser, id: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id, organizationId: requireOrgId(actor) },
    });
    if (!invitation) throw new NotFoundException("Invitation not found");
    return this.prisma.invitation.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  }

  async accept(input: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
  }) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: input.token },
      include: { organization: true },
    });
    if (!invitation || invitation.status !== "PENDING") {
      throw new NotFoundException("Invitation is invalid");
    }
    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      throw new BadRequestException("Invitation has expired");
    }
    if (!invitation.organization.isActive) {
      throw new BadRequestException("Organization is suspended");
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existing)
      throw new ConflictException("An account with this email already exists");

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: invitation.organizationId,
          email: invitation.email,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          departmentId: invitation.departmentId,
          mustChangePassword: false,
          roles: invitation.roleId
            ? { create: [{ roleId: invitation.roleId }] }
            : undefined,
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      return created;
    });

    await this.activities.logActivity({
      userId: user.id,
      organizationId: invitation.organizationId,
      action: "INVITATION_ACCEPTED",
      entityType: "Invitation",
      entityId: invitation.id,
      description: `${user.email} joined ${invitation.organization.name}`,
    });
    return user;
  }

  private assertSeat(
    seatLimit: number | null | undefined,
    activeUsers: number,
  ) {
    if (seatLimit && activeUsers >= seatLimit) {
      throw new BadRequestException("Organization seat limit reached");
    }
  }

  private assertDomain(domains: string[], email: string) {
    if (!domains.length) return;
    const ok = domains.some((domain) =>
      email.endsWith(`@${domain.toLowerCase()}`),
    );
    if (!ok)
      throw new BadRequestException(
        "Email domain is not allowed for this organization",
      );
  }
}
