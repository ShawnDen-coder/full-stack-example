import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.union([z.literal("ok"), z.literal("degraded")]),
  services: z.object({
    database: z.object({ status: z.union([z.literal("up"), z.literal("down")]) }),
  }),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
