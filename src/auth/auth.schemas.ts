import { z } from "zod";
import { createZodDto, ZodDto } from "nestjs-zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;
export class LoginDto extends createZodDto(loginSchema) {}

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;
export class RefreshDto extends createZodDto(refreshSchema) {}

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}

export const registerOrganizationSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  industry: z.string().trim().max(80).optional(),
  timezone: z.string().trim().min(1).max(64).default("Africa/Lagos"),
  website: z.string().trim().url().optional(),
  legalName: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  staffRange: z.enum(["1-10", "11-50", "51-200", "201-500", "500+"]).optional(),
  registrationNumber: z.string().trim().max(80).optional(),
  about: z.string().trim().max(2000).optional(),
  ownerFirstName: z.string().trim().min(1).max(100),
  ownerLastName: z.string().trim().min(1).max(100),
  ownerEmail: z.string().trim().email(),
  ownerPassword: z.string().min(8).max(128),
});
export type RegisterOrganizationInput = z.infer<
  typeof registerOrganizationSchema
>;
export class RegisterOrganizationDto extends createZodDto(
  registerOrganizationSchema,
) {}

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(20),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(128),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export class AcceptInvitationDto extends createZodDto(acceptInvitationSchema) {}
