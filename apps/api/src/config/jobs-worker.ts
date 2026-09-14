import type { Environment, LogLevel } from "@full-stack-example/logging";
import { z } from "zod";
import { logLevels, resolveLogLevel, resolvePrettyLogging } from "./shared.js";

const jobsWorkerSchema = z.object({
  DATABASE_RUNTIME_URL: z.url(),
  JOBS_POOL_MAX: z.coerce.number().int().min(2).max(100).default(10),
  JOBS_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(logLevels).optional(),
  LOG_PRETTY: z.enum(["true", "false"]).default("true"),
});

export interface JobsWorkerConfig {
  readonly databaseUrl: string;
  readonly poolMax: number;
  readonly concurrency: number;
  readonly environment: Environment;
  readonly logLevel: LogLevel;
  readonly pretty: boolean;
}

export function parseJobsWorkerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): JobsWorkerConfig {
  const parsed = jobsWorkerSchema.parse(environment);
  return {
    databaseUrl: parsed.DATABASE_RUNTIME_URL,
    poolMax: parsed.JOBS_POOL_MAX,
    concurrency: parsed.JOBS_WORKER_CONCURRENCY,
    environment: parsed.NODE_ENV,
    logLevel: resolveLogLevel(parsed.NODE_ENV, parsed.LOG_LEVEL),
    pretty: resolvePrettyLogging(parsed.NODE_ENV, parsed.LOG_PRETTY),
  };
}
