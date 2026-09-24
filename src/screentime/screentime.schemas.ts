import { z } from "zod";
import { createZodDto, ZodDto } from "nestjs-zod";
import { dateInput } from "../common/validation/date.schema";

export const appUsageSchema = z.object({
  appName: z.string().min(1).max(100),
  category: z.string().max(50).optional(),
  durationSeconds: z.number().int().min(0),
});

export const logScreentimeSchema = z.object({
  date: dateInput.optional(),
  deviceInfo: z.string().max(200).optional(),
  activeSeconds: z.number().int().min(0).default(0),
  idleSeconds: z.number().int().min(0).default(0),
  topApps: z.array(appUsageSchema).default([]),
});
export type LogScreentimeInput = z.infer<typeof logScreentimeSchema>;
export class LogScreentimeDto extends createZodDto(logScreentimeSchema) {}

export const queryScreentimeSchema = z.object({
  startDate: dateInput.optional(),
  endDate: dateInput.optional(),
  userId: z.string().uuid().optional(),
});
export type QueryScreentimeInput = z.infer<typeof queryScreentimeSchema>;
