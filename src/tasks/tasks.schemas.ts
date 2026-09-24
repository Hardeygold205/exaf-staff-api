import { z } from 'zod';
import { createZodDto, ZodDto } from "nestjs-zod";
import { dateInput } from '../common/validation/date.schema';

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: dateInput.nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export class CreateTaskDto extends createZodDto(createTaskSchema) {}

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: dateInput.nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export class UpdateTaskDto extends createZodDto(updateTaskSchema) {}

export const updateTaskStatusSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED']),
});
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export class UpdateTaskStatusDto extends createZodDto(updateTaskStatusSchema) {}
