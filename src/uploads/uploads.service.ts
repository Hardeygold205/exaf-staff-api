import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { join } from "path";
import { PrismaService } from "../infra/prisma/prisma.service";
import { StorageService } from "../infra/storage/storage.service";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { QueryUploadsInput, UploadMetaInput } from "./uploads.schemas";
import { Prisma } from "@prisma/client";

@Injectable()
export class UploadsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async uploadOne(
    user: AuthUser,
    file: Express.Multer.File,
    meta: UploadMetaInput,
  ) {
    await this.assertEntityAccess(user, meta);
    const pathInfo = this.pathInfo(file.originalname);
    const { url, key } = await this.storage.upload(file, "uploads");

    return this.prisma.upload.create({
      data: {
        uploadedById: user.id,
        originalName: pathInfo.fileName,
        storedKey: key,
        url,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        driver: this.storage.driverName === "s3" ? "S3" : "LOCAL",
        entityType: meta.entityType,
        entityId: meta.entityId,
        relativePath: pathInfo.relativePath,
        folderName: pathInfo.folderName,
      },
    });
  }

  async uploadMany(
    user: AuthUser,
    files: Express.Multer.File[],
    meta: UploadMetaInput,
  ) {
    await this.assertEntityAccess(user, meta);
    return Promise.all(files.map((file) => this.uploadOne(user, file, meta)));
  }

  async findOwn(userId: string) {
    return this.prisma.upload.findMany({
      where: { uploadedById: userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findForEntity(user: AuthUser, query: QueryUploadsInput) {
    const hasGlobalView =
      user.permissions.includes("uploads:view_all") ||
      user.permissions.includes("uploads:manage");

    const where: Prisma.UploadWhereInput = {};

    if (query.entityType && query.entityId) {
      await this.assertEntityAccess(user, {
        entityType: query.entityType,
        entityId: query.entityId,
      });
      where.entityType = query.entityType;
      where.entityId = query.entityId;
    } else if (!hasGlobalView) {
      // Non-admin users without specific entity parameters see their own uploads by default
      where.uploadedById = user.id;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.upload.findMany({
        where,
        include: {
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.upload.count({ where }),
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

  async findOne(id: string, user: AuthUser) {
    const doc = await this.prisma.upload.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Upload not found");
    await this.assertEntityAccess(user, doc);
    return doc;
  }

  async getDownloadTarget(id: string, user: AuthUser) {
    const doc = await this.findOne(id, user);
    if (doc.driver === "S3") {
      const url = await this.storage.getPresignedDownloadUrl(
        doc.storedKey,
        doc.originalName,
      );
      return { type: "redirect" as const, url };
    }
    const uploadDir = process.env.UPLOAD_DIR ?? "uploads";
    return {
      type: "local" as const,
      path: join(process.cwd(), uploadDir, doc.storedKey),
      filename: doc.originalName,
    };
  }

  async remove(id: string, user: AuthUser) {
    const doc = await this.prisma.upload.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Upload not found");
    await this.assertEntityAccess(user, doc);

    if (
      doc.uploadedById !== user.id &&
      !user.permissions.includes("uploads:manage")
    ) {
      throw new ForbiddenException("You can only delete your own uploads");
    }

    await this.storage.deleteObject(doc.storedKey);
    await this.prisma.upload.delete({ where: { id } });
    return null;
  }

  private async assertEntityAccess(
    user: AuthUser,
    resource: {
      entityType?: string | null;
      entityId?: string | null;
      uploadedById?: string;
    },
  ) {
    if (!resource.entityType && !resource.entityId) {
      if (resource.uploadedById && resource.uploadedById === user.id) return;
      if (
        user.permissions.includes("uploads:view_all") ||
        user.permissions.includes("uploads:manage")
      )
        return;
      throw new ForbiddenException("You do not have access to this upload");
    }

    if (!resource.entityType || !resource.entityId) {
      throw new ForbiddenException("Invalid upload ownership reference");
    }

    if (
      user.permissions.includes("uploads:view_all") ||
      user.permissions.includes("uploads:manage")
    )
      return;

    switch (resource.entityType) {
      case "PROJECT": {
        const project = await this.prisma.project.findFirst({
          where: {
            id: resource.entityId,
            OR: [
              { createdById: user.id },
              { members: { some: { userId: user.id } } },
            ],
          },
          select: { id: true },
        });
        if (!project)
          throw new ForbiddenException(
            "You do not have access to this project",
          );
        return;
      }
      case "TASK": {
        const task = await this.prisma.task.findFirst({
          where: {
            id: resource.entityId,
            OR: [
              { creatorId: user.id },
              { assigneeId: user.id },
              { project: { members: { some: { userId: user.id } } } },
            ],
          },
          select: { id: true },
        });
        if (!task)
          throw new ForbiddenException("You do not have access to this task");
        return;
      }
      case "STAFF_REQUEST": {
        const request = await this.prisma.staffRequest.findFirst({
          where: {
            id: resource.entityId,
            OR: [{ userId: user.id }, { reviewedById: user.id }],
          },
          select: { id: true },
        });
        if (!request)
          throw new ForbiddenException(
            "You do not have access to this request",
          );
        return;
      }
      case "EVENT":
        return;
      default:
        throw new ForbiddenException("Unsupported upload entity type");
    }
  }

  private pathInfo(originalName: string) {
    const normalized = originalName.replace(/\\/g, "/").replace(/^\/+/, "");
    const parts = normalized
      .split("/")
      .filter(Boolean)
      .map((part) => part.replace(/[\u0000]/g, ""));
    const fileName = parts.pop() ?? "file";
    const relativePath = parts.length ? [...parts, fileName].join("/") : null;
    const folderName = parts.length ? parts[0] : null;
    return { fileName, relativePath, folderName };
  }
}
