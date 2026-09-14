import { z } from "zod";
import { parseEnvironment, resolveLoggingEnvironment, sharedEnvironmentShape } from "./shared.js";

export const jobsWorkerEnvironmentSchema = z
  .object({
    ...sharedEnvironmentShape,
    DATABASE_RUNTIME_URL: z.url(),
    JOBS_POOL_MAX: z.coerce.number().int().min(2).max(100).default(10),
    JOBS_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  })
  .transform(resolveLoggingEnvironment);

export type JobsWorkerEnvironment = z.output<typeof jobsWorkerEnvironmentSchema>;

export function parseJobsWorkerEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): JobsWorkerEnvironment {
  return parseEnvironment("Jobs Worker", jobsWorkerEnvironmentSchema, source);
}
