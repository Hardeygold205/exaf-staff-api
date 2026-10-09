import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const createInvitationSchema = z.object({
  email: z.string().trim().email(),
  roleId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export class CreateInvitationDto extends createZodDto(createInvitationSchema) {}
