import { z } from 'zod';

/** Accepts YYYY-MM-DD or a full ISO timestamp. */
export const dateInput = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid date' });
