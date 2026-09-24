import { z } from 'zod';
import { createZodDto, ZodDto } from "nestjs-zod";
import { dateInput } from '../common/validation/date.schema';

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  startDate: dateInput.nullable().optional(),
  endDate: dateInput.nullable().optional(),
  memberUserIds: z.array(z.string().uuid()).default([]),
}).superRefine((data, ctx) => {
  if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'endDate cannot be before startDate' });
  }
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export class CreateProjectDto extends createZodDto(createProjectSchema) {}

export const updateProjectStatusSchema = z.object({
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED']),
});
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
export class UpdateProjectStatusDto extends createZodDto(updateProjectStatusSchema) {}
