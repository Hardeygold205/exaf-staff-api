import { z } from "zod";
import { createZodDto, ZodDto } from "nestjs-zod";

export const setAttendanceExemptionSchema = z.object({
  exempt: z.boolean(),
});
export type SetAttendanceExemptionInput = z.infer<
  typeof setAttendanceExemptionSchema
>;
export class SetAttendanceExemptionDto extends createZodDto(
  setAttendanceExemptionSchema,
) {}
