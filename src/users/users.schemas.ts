import { z } from "zod";
import { createZodDto, ZodDto } from "nestjs-zod";
import { companyEmail } from "../common/validation/email.schema";
import { dateInput } from "../common/validation/date.schema";

const name = z.string().trim().min(1).max(100);
const department = z.string().trim().min(1).max(120);
const position = z.string().trim().min(1).max(120);
const officeBranch = z.enum(["ABUJA", "KANO"]).optional();
const shift = z.enum(["ONSITE", "REMOTE", "HYBRID"]);

/** Fields HR/SUPERADMIN must provide when provisioning an account. */
export const createUserSchema = z.object({
  email: companyEmail,
  firstName: name,
  lastName: name,
  department,
  position,
  officeBranch: officeBranch,
  shift: shift,
  isIntern: z.boolean().default(false),
  roleNames: z
    .array(z.string().trim().min(1))
    .min(1, "At least one role is required"),

  // These are optional because the staff member can complete their profile after login.
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

/** Staff controlled profile fields. Employment fields and identity credentials stay admin controlled. */
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

/** Administrative changes. */
export const adminUpdateUserSchema = z.object({
  firstName: name.optional(),
  lastName: name.optional(),
  middleName: name.nullable().optional(),
  department: department.optional(),
  position: position.optional(),
  officeBranch: officeBranch,
  shift: shift,
  isIntern: z.boolean().optional(),
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
export class SetUserPermissionsDto extends createZodDto(
  setUserPermissionsSchema,
) {}
