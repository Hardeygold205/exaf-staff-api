import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { dateInput } from "../common/validation/date.schema";

const memberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["OWNER", "MANAGER", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  visibility: z.enum(["PUBLIC", "DEPARTMENT", "PRIVATE"]).default("DEPARTMENT"),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]).optional(),
  startDate: dateInput.nullable().optional(),
  endDate: dateInput.nullable().optional(),
  members: z.array(memberSchema).default([]),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export class CreateProjectDto extends createZodDto(createProjectSchema) {}

export const updateProjectSchema = createProjectSchema.partial().omit({ members: true });
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export class UpdateProjectDto extends createZodDto(updateProjectSchema) {}

export const updateProjectStatusSchema = z.object({
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]),
});
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
export class UpdateProjectStatusDto extends createZodDto(updateProjectStatusSchema) {}

export const addProjectMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["OWNER", "MANAGER", "MEMBER", "VIEWER"]).default("MEMBER"),
});
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export class AddProjectMemberDto extends createZodDto(addProjectMemberSchema) {}
