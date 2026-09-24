import { z } from "zod";

export const queryNotificationsSchema = z.object({
  isRead: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type QueryNotificationsInput = z.infer<typeof queryNotificationsSchema>;
