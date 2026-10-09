import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const staffRangeSchema = z.enum([
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "500+",
]);

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  website: z.string().trim().url().nullable().optional(),
  industry: z.string().trim().max(80).nullable().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  logoUrl: z.string().trim().url().nullable().optional(),
  iconUrl: z.string().trim().min(1).nullable().optional(),
  legalName: z.string().trim().max(160).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  state: z.string().trim().max(80).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  staffRange: staffRangeSchema.nullable().optional(),
  registrationNumber: z.string().trim().max(80).nullable().optional(),
  about: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export class UpdateOrganizationDto extends createZodDto(
  updateOrganizationSchema,
) {}

export const updateOrganizationSettingsSchema = z.object({
  workStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  workEndTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  autoCheckoutTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  workDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  enableScreentime: z.boolean().optional(),
  enableSuggestions: z.boolean().optional(),
  allowedRequestCategories: z.array(z.string().trim().min(1)).optional(),
  allowedEmailDomains: z.array(z.string().trim().min(1).max(120)).optional(),
});
export type UpdateOrganizationSettingsInput = z.infer<
  typeof updateOrganizationSettingsSchema
>;
export class UpdateOrganizationSettingsDto extends createZodDto(
  updateOrganizationSettingsSchema,
) {}

export const setOrganizationStatusSchema = z.object({
  isActive: z.boolean(),
});
export type SetOrganizationStatusInput = z.infer<
  typeof setOrganizationStatusSchema
>;
export class SetOrganizationStatusDto extends createZodDto(
  setOrganizationStatusSchema,
) {}
