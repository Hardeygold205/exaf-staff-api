import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { copyFile, mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: string;
  private readonly uploadDir: string;
  private s3: S3Client | null = null;

  constructor(private config: ConfigService) {
    this.driver = this.config.get("STORAGE_DRIVER", "s3");
    this.uploadDir = this.config.get("UPLOAD_DIR", "uploads");

    if (this.driver === "s3") {
      this.s3 = new S3Client({
        endpoint: this.config.getOrThrow("AWS_S3_ENDPOINT"),

        region: this.config.get("AWS_REGION", "eu-central-1"),

        forcePathStyle: true,

        requestChecksumCalculation: "WHEN_REQUIRED",

        credentials: {
          accessKeyId: this.config.getOrThrow("AWS_ACCESS_KEY_ID"),
          secretAccessKey: this.config.getOrThrow("AWS_SECRET_ACCESS_KEY"),
        },
      });
    }
  }

  get driverName(): string {
    return this.driver;
  }

  async upload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<{ url: string; key: string }> {
    const ext = this.extension(file.originalname, file.mimetype);
    const key = `${folder}/${randomUUID()}${ext}`;

    const url =
      this.driver === "s3"
        ? await this.uploadS3(file, key)
        : await this.uploadLocal(file, key);
    return { url, key };
  }

  async deleteObject(key: string): Promise<void> {
    if (this.driver === "s3") {
      if (!this.s3) throw new Error("S3 client is not configured");
      const bucket = this.config.getOrThrow<string>("AWS_S3_BUCKET");
      await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return;
    }
    const dest = join(process.cwd(), this.uploadDir, key);
    await unlink(dest).catch(() => undefined);
  }

  /**
   * Presigned S3 URL that forces a real download with the original filename,
   * instead of opening inline in the browser (which is S3's default for
   * video/PDF/etc. served via a plain object URL). Short-lived by design —
   * generate a fresh one per download click rather than storing/reusing it.
   */
  async getPresignedDownloadUrl(
    key: string,
    downloadFilename: string,
  ): Promise<string> {
    if (!this.s3) throw new Error("S3 client is not configured");
    const bucket = this.config.getOrThrow<string>("AWS_S3_BUCKET");
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${downloadFilename}"`,
    });
    return getSignedUrl(this.s3, command, { expiresIn: 300 });
  }

  private async uploadLocal(
    file: Express.Multer.File,
    key: string,
  ): Promise<string> {
    const dest = join(process.cwd(), this.uploadDir, key);
    await mkdir(join(dest, ".."), { recursive: true });

    if (file.path) {
      await copyFile(file.path, dest);
      await unlink(file.path).catch(() => undefined);
    } else {
      await writeFile(dest, file.buffer);
    }
    return `/${this.uploadDir}/${key}`;
  }

  private async uploadS3(
    file: Express.Multer.File,
    key: string,
  ): Promise<string> {
    if (!this.s3) throw new Error("S3 client is not configured");
    const bucket = this.config.getOrThrow<string>("AWS_S3_BUCKET");

    const body = file.path ? createReadStream(file.path) : file.buffer;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: file.mimetype,
      }),
    );
    if (file.path) await unlink(file.path).catch(() => undefined);

    const publicBase = this.config.get<string>("AWS_S3_PUBLIC_BASE_URL");
    if (publicBase) return `${publicBase.replace(/\/$/, "")}/${key}`;

    const region = this.config.get("AWS_REGION");
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private extension(originalName: string, mime: string): string {
    const fromName = originalName.includes(".")
      ? originalName.slice(originalName.lastIndexOf("."))
      : "";
    if (fromName && fromName.length <= 8) return fromName.toLowerCase();
    const map: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
      "video/mp4": ".mp4",
      "audio/mpeg": ".mp3",
    };
    return map[mime] ?? "";
  }
}
