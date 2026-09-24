import { z } from 'zod';
import { createZodDto, ZodDto } from 'nestjs-zod';

const currentDate = new Date();

export const monthlyCalendarQuerySchema = z.object({
  year: z.preprocess(
    (val) =>
      val === undefined || val === "" ? currentDate.getUTCFullYear() : val,
    z.coerce.number().int().min(2000).max(2100),
  ),
  month: z.preprocess(
    (val) =>
      val === undefined || val === "" ? currentDate.getUTCMonth() + 1 : val,
    z.coerce.number().int().min(1).max(12),
  ),
});

export type MonthlyCalendarQuery = z.infer<typeof monthlyCalendarQuerySchema>;
export class MonthlyCalendarQueryDto extends createZodDto(monthlyCalendarQuerySchema) {}
