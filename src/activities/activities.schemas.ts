import { z } from "zod";
import { dateInput } from "../common/validation/date.schema";

export const queryActivitiesSchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  startDate: dateInput.optional(),
  endDate: dateInput.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type QueryActivitiesInput = z.infer<typeof queryActivitiesSchema>;
