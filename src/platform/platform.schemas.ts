import { z } from "zod";
import { createZodDto, ZodDto } from "nestjs-zod";

export const platformListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["active", "suspended", "all"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PlatformListQuery = z.infer<typeof platformListQuerySchema>;
export class PlatformListQueryDto extends createZodDto(platformListQuerySchema) {}

export const platformSignupsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PlatformSignupsQuery = z.infer<typeof platformSignupsQuerySchema>;
export class PlatformSignupsQueryDto extends createZodDto(platformSignupsQuerySchema) {}

export const platformActivityQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  action: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type PlatformActivityQuery = z.infer<typeof platformActivityQuerySchema>;
export class PlatformActivityQueryDto extends createZodDto(platformActivityQuerySchema) {}
