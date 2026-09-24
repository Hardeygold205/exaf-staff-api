import { z } from "zod";
import { createZodDto, ZodDto } from "nestjs-zod";

export const checkoutReasonTypeSchema = z.enum([
  "FORGOT_TO_CHECKOUT",
  "WORKING_IN_OFFICE",
  "URGENT_TASK",
  "MEETING",
  "COMPANY_ASSIGNMENT",
  "REQUESTED_TO_WORK_LATE",
  "TECHNICAL_ISSUE",
  "OTHER",
]);

export const checkInSchema = z.object({
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
});

export const checkOutSchema = z.object({
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
  reasonType: checkoutReasonTypeSchema.optional(),
  reasonText: z.string().trim().max(1000).optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;

export class CheckInDto extends createZodDto(checkInSchema) {}
export class CheckOutDto extends createZodDto(checkOutSchema) {}

export const reviewAttendanceSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});
export type ReviewAttendanceInput = z.infer<typeof reviewAttendanceSchema>;
export class ReviewAttendanceDto extends createZodDto(reviewAttendanceSchema) {}
