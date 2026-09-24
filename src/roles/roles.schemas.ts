import { z } from "zod";
import { createZodDto, ZodDto } from "nestjs-zod";

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(64)
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      "Role name must be UPPER_SNAKE_CASE (e.g. MARKETING_LEAD)",
    ),
  description: z.string().max(500).optional(),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export class CreateRoleDto extends createZodDto(createRoleSchema) {}

export const setRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string().min(1)),
});
export type SetRolePermissionsInput = z.infer<typeof setRolePermissionsSchema>;
export class SetRolePermissionsDto extends createZodDto(
  setRolePermissionsSchema,
) {}
