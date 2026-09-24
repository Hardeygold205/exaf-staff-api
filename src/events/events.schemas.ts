import { z } from "zod";
import { createZodDto, ZodDto } from "nestjs-zod";
import { dateInput } from "../common/validation/date.schema";

const eventType = z.enum([
  "ANNOUNCEMENT",
  "PUBLIC_HOLIDAY",
  "COMPANY_EVENT",
  "MEETING",
  "TRAINING",
  "OTHER",
]);

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).optional(),
    type: eventType.default("ANNOUNCEMENT"),
    startsAt: dateInput,
    endsAt: dateInput.nullable().optional(),
    allDay: z.boolean().default(false),
    linkUrl: z.string().url().optional(),
    linkLabel: z.string().trim().min(1).max(80).optional(),
    notifyByEmail: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.endsAt && new Date(data.endsAt) < new Date(data.startsAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "endsAt cannot be before startsAt",
      });
    }
    if (data.linkLabel && !data.linkUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["linkUrl"],
        message: "linkUrl is required when linkLabel is provided",
      });
    }
  });
export type CreateEventInput = z.infer<typeof createEventSchema>;
export class CreateEventDto extends createZodDto(createEventSchema) {}

export const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  type: eventType.optional(),
  startsAt: dateInput.optional(),
  endsAt: dateInput.nullable().optional(),
  allDay: z.boolean().optional(),
  linkUrl: z.string().url().nullable().optional(),
  linkLabel: z.string().trim().min(1).max(80).nullable().optional(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export class UpdateEventDto extends createZodDto(updateEventSchema) {}
