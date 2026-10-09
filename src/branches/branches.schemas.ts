import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export class CreateBranchDto extends createZodDto(createBranchSchema) {}

export const updateBranchSchema = createBranchSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export class UpdateBranchDto extends createZodDto(updateBranchSchema) {}
