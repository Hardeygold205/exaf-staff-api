import { z } from 'zod';
import { createZodDto, ZodDto } from "nestjs-zod";

export const UPLOAD_ENTITY_TYPES = ['PROJECT', 'TASK', 'STAFF_REQUEST', 'EVENT'] as const;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
] as const;

export const uploadMetaSchema = z.object({
  entityType: z.enum(UPLOAD_ENTITY_TYPES).optional(),
  entityId: z.string().uuid().optional(),
}).refine(
  (data) => (!data.entityType && !data.entityId) || (!!data.entityType && !!data.entityId),
  { message: 'entityType and entityId must be provided together', path: ['entityType'] },
);

export const queryUploadsSchema = z.object({
  entityType: z.enum(UPLOAD_ENTITY_TYPES).optional(),
  entityId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type UploadMetaInput = z.infer<typeof uploadMetaSchema>;
export type QueryUploadsInput = z.infer<typeof queryUploadsSchema>;
export class UploadMetaDto extends createZodDto(uploadMetaSchema) {}
