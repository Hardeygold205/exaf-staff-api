import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { companyEmail } from "../common/validation/email.schema";
import { dateInput } from "../common/validation/date.schema";

const name = z.string().trim().min(1).max(100);
const position = z.string().trim().min(1).max(120);
const shift = z.enum(["ONSITE", "REMOTE", "HYBRID"]);

/** Fields an org admin provides when provisioning an account. */
export const createUserSchema = z.object({
  email: companyEmail,
  firstName: name,
  lastName: name,
  departmentId: z.string().uuid().nullable().optional(),
  position,
  officeBranchId: z.string().uuid().nullable().optional(),
  shift: shift.default("ONSITE"),
  isIntern: z.boolean().default(false),
  attendanceExempt: z.boolean().default(false).optional(),
  roleNames: z
    .array(z.string().trim().min(1))
    .min(1, "At least one role is required"),
  middleName: name.optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  dateOfBirth: dateInput.optional(),
  bio: z.string().trim().max(2000).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
export class CreateUserDto extends createZodDto(createUserSchema) {}

export const updateMeSchema = z.object({
  middleName: name.nullable().optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .nullable()
    .optional(),
  dateOfBirth: dateInput.nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export class UpdateMeDto extends createZodDto(updateMeSchema) {}

export const adminUpdateUserSchema = z.object({
  firstName: name.optional(),
  lastName: name.optional(),
  middleName: name.nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  position: position.optional(),
  officeBranchId: z.string().uuid().nullable().optional(),
  shift: shift.optional(),
  isIntern: z.boolean().optional(),
  attendanceExempt: z.boolean().optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .nullable()
    .optional(),
  dateOfBirth: dateInput.nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  roleNames: z.array(z.string().trim().min(1)).min(1).optional(),
});
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export class AdminUpdateUserDto extends createZodDto(adminUpdateUserSchema) {}

export const setUserPermissionsSchema = z.object({
  grant: z.array(z.string().trim().min(1)).default([]),
  revoke: z.array(z.string().trim().min(1)).default([]),
});
export type SetUserPermissionsInput = z.infer<typeof setUserPermissionsSchema>;
export class SetUserPermissionsDto extends createZodDto(setUserPermissionsSchema) {}
