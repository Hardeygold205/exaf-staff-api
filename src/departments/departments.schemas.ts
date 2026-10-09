import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  headUserId: z.string().uuid().nullable().optional(),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export class CreateDepartmentDto extends createZodDto(createDepartmentSchema) {}

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export class UpdateDepartmentDto extends createZodDto(updateDepartmentSchema) {}
