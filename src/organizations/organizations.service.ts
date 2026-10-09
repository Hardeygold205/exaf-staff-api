import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../infra/prisma/prisma.service";
import { StorageService } from "../infra/storage/storage.service";
import { ActivitiesService } from "../activities/activities.service";
import {
  UpdateOrganizationInput,
  UpdateOrganizationSettingsInput,
} from "./organizations.schemas";
import { DEFAULT_ORG_ROLES, PLATFORM_ONLY_PERMISSIONS } from "./default-roles";

export interface RegisterOrganizationInput {
  organizationName: string;
  slug?: string;
  industry?: string;
  timezone?: string;
  website?: string;
  legalName?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  staffRange?: string;
  registrationNumber?: string;
  about?: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
  ownerPassword: string;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function seatLimitFor(staffRange?: string) {
  switch (staffRange) {
    case "1-10":
      return 10;
    case "11-50":
      return 50;
    case "51-200":
      return 200;
    case "201-500":
      return 500;
    case "500+":
      return 1000;
    default:
      return 25;
  }
}

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private activities: ActivitiesService,
    private storage: StorageService,
  ) {}

  async register(input: RegisterOrganizationInput) {
    const email = input.ownerEmail.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException("An account with this email already exists");
    }

    const baseSlug = slugify(input.slug || input.organizationName) || "org";
    const slug = await this.uniqueSlug(baseSlug);
    const passwordHash = await bcrypt.hash(input.ownerPassword, 12);

    const organization = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.organizationName.trim(),
          slug,
          industry: input.industry,
          timezone: input.timezone || "Africa/Lagos",
          website: input.website,
          legalName: input.legalName,
          phone: input.phone,
          address: input.address,
          city: input.city,
          state: input.state,
          country: input.country,
          staffRange: input.staffRange,
          registrationNumber: input.registrationNumber,
          about: input.about,
          settings: { create: { seatLimit: seatLimitFor(input.staffRange) } },
        },
      });

      const permissions = await tx.permission.findMany();
      const byKey = new Map(
        permissions.map((permission) => [permission.key, permission.id]),
      );

      const createdRoles = new Map<string, string>();
      for (const [name, spec] of Object.entries(DEFAULT_ORG_ROLES)) {
        const keys =
          spec.permissions === "*"
            ? permissions
                .map((permission) => permission.key)
                .filter((key) => !PLATFORM_ONLY_PERMISSIONS.includes(key))
            : spec.permissions.filter((key) => byKey.has(key));
        const role = await tx.role.create({
          data: {
            organizationId: org.id,
            name,
            description: spec.description,
            isSystem: spec.isSystem,
            permissions: {
              create: keys.map((key) => ({ permissionId: byKey.get(key)! })),
            },
          },
        });
        createdRoles.set(name, role.id);
      }

      await tx.user.create({
        data: {
          organizationId: org.id,
          email,
          passwordHash,
          firstName: input.ownerFirstName.trim(),
          lastName: input.ownerLastName.trim(),
          position: "Organization Owner",
          mustChangePassword: false,
          roles: { create: [{ roleId: createdRoles.get("ORG_OWNER")! }] },
        },
      });

      return org;
    });

    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { email },
    });

    await this.activities.logActivity({
      userId: owner.id,
      organizationId: organization.id,
      action: "ORGANIZATION_CREATED",
      entityType: "Organization",
      entityId: organization.id,
      description: `Organization ${organization.name} registered`,
    });

    return { organization, owner };
  }

  async findMine(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        settings: true,
        _count: { select: { users: true, departments: true } },
      },
    });
    if (!organization) throw new NotFoundException("Organization not found");
    return organization;
  }

  async uploadBrand(
    organizationId: string,
    actorId: string,
    kind: "logo" | "icon",
    file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("Image file is required");
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        "Logo and icon must be PNG, JPEG, WebP, or SVG",
      );
    }
    const { url } = await this.storage.upload(
      file,
      `organizations/${organizationId}`,
    );
    const data = kind === "logo" ? { logoUrl: url } : { iconUrl: url };
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data,
    });
    await this.activities.logActivity({
      userId: actorId,
      organizationId,
      action:
        kind === "logo"
          ? "ORGANIZATION_LOGO_UPDATED"
          : "ORGANIZATION_ICON_UPDATED",
      entityType: "Organization",
      entityId: organizationId,
      description: `Organization ${kind} updated`,
    });
    return organization;
  }

  async updateMine(
    organizationId: string,
    dto: UpdateOrganizationInput,
    actorId: string,
  ) {
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: dto,
    });
    await this.activities.logActivity({
      userId: actorId,
      organizationId,
      action: "ORGANIZATION_UPDATED",
      entityType: "Organization",
      entityId: organizationId,
      description: `Organization profile updated`,
    });
    return organization;
  }

  async updateSettings(
    organizationId: string,
    dto: UpdateOrganizationSettingsInput,
    actorId: string,
  ) {
    const settings = await this.prisma.organizationSettings.upsert({
      where: { organizationId },
      update: dto,
      create: { organizationId, ...dto },
    });
    await this.activities.logActivity({
      userId: actorId,
      organizationId,
      action: "ORGANIZATION_SETTINGS_UPDATED",
      entityType: "OrganizationSettings",
      entityId: settings.id,
      description: "Organization settings updated",
    });
    return settings;
  }

  async listAll() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } }, settings: true },
    });
  }

  async setStatus(id: string, isActive: boolean, actorId: string) {
    const organization = await this.prisma.organization.update({
      where: { id },
      data: { isActive },
    });
    await this.activities.logActivity({
      userId: actorId,
      organizationId: id,
      action: isActive ? "ORGANIZATION_ACTIVATED" : "ORGANIZATION_SUSPENDED",
      entityType: "Organization",
      entityId: id,
      description: `Organization ${organization.name} ${isActive ? "activated" : "suspended"}`,
    });
    return organization;
  }

  private async uniqueSlug(base: string) {
    let slug = base;
    let n = 2;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }
}
