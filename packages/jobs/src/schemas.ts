import { z } from "zod";

export const exampleJobSchema = z.object({
  message: z.string().trim().min(1).max(500),
  steps: z.number().int().min(1).max(100).default(10),
  stepDelayMs: z.number().int().min(0).max(5_000).default(100),
  failAtStep: z.number().int().min(1).max(100).optional(),
});
