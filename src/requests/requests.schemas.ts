import { z } from "zod";
import { createZodDto, ZodDto } from "nestjs-zod";
import { companyEmail } from "../common/validation/email.schema";
import { dateInput } from "../common/validation/date.schema";
import {
  DATE_REQUIRED_CATEGORIES,
  REQUEST_CATEGORIES,
} from "./request-categories";

export const createRequestSchema = z
  .object({
    category: z.enum(REQUEST_CATEGORIES),
    subject: z.string().min(1).max(200),
    details: z.string().max(5000).optional(),
    startDate: dateInput.optional(),
    endDate: dateInput.optional(),
    notifyToEmails: z.array(companyEmail).default([]),
    notifyCcEmails: z.array(companyEmail).default([]),
  })
  .superRefine((data, ctx) => {
    if (DATE_REQUIRED_CATEGORIES.includes(data.category)) {
      if (!data.startDate) {
        ctx.addIssue({
          code: "custom",
          path: ["startDate"],
          message: "startDate is required for leave/travel",
        });
      }
      if (!data.endDate) {
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "endDate is required for leave/travel",
        });
      }
    }
    if (
      data.startDate &&
      data.endDate &&
      new Date(data.endDate) < new Date(data.startDate)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "endDate cannot be before startDate",
      });
    }
  });
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export class CreateRequestDto extends createZodDto(createRequestSchema) {}

export const reviewRequestSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
});
export type ReviewRequestInput = z.infer<typeof reviewRequestSchema>;
export class ReviewRequestDto extends createZodDto(reviewRequestSchema) {}
