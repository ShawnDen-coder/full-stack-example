import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Environment, LogLevel } from "@full-stack-example/logging";
import { z } from "zod";

const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const logLevels = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;
const jobsWorkerEnvironmentSchema = z.object({
  DATABASE_URL: z.url().optional(),
  DATABASE_RUNTIME_URL: z.url().optional(),
  JOBS_POOL_MAX: z.coerce.number().int().min(2).max(100).default(10),
  JOBS_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(logLevels).optional(),
  LOG_PRETTY: z.enum(["true", "false"]).default("true"),
});
const environmentSchema = z.object({
  DATABASE_URL: z.url().optional(),
  DATABASE_RUNTIME_URL: z.url().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z.url().default("http://localhost:5173"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  WEB_ASSETS_DIR: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(logLevels).optional(),
  LOG_PRETTY: z.enum(["true", "false"]).default("true"),
  LOG_FILE: z.string().min(1).optional(),
  OTEL_ENABLED: z.enum(["true", "false"]).optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().default("http://localhost:4318"),
  OTEL_METRIC_EXPORT_INTERVAL: z.coerce.number().int().min(1000).default(10_000),
  LOG_STREAM_ENABLED: z.enum(["true", "false"]).default("false"),
  LOG_STREAM_BUFFER_SIZE: z.coerce.number().int().min(1).max(10_000).default(1000),
  LOG_STREAM_HEARTBEAT_MS: z.coerce.number().int().min(1000).default(15_000),
  API_DOCS_ENABLED: z.enum(["true", "false"]).optional(),
  PLATFORM_ADMIN_EMAIL: z.email().optional(),
  PLATFORM_ADMIN_NAME: z.string().min(1).optional(),
  PLATFORM_ADMIN_PASSWORD: z.string().min(8).optional(),
  JOBS_ENABLED: z.enum(["true", "false"]).default("true"),
  JOBS_POOL_MAX: z.coerce.number().int().min(2).max(100).default(10),
  JOBS_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  BULL_BOARD_ENABLED: z.enum(["true", "false"]).default("false"),
  BULL_BOARD_BASE_PATH: z
    .string()
    .regex(/^\/[a-zA-Z0-9/_-]+$/)
    .default("/admin/queues"),
  BULL_BOARD_CSRF_SECRET: z.string().min(32).optional(),
});

export interface ApiConfig {
  readonly databaseRuntimeUrl: string;
  readonly databasePoolMax: number;
  readonly host: string;
  readonly port: number;
  readonly webOrigin: string;
  readonly betterAuthSecret: string;
  readonly betterAuthUrl: string;
  readonly webAssetsDirectory?: string;
  readonly environment: Environment;
  readonly logLevel: LogLevel;
  readonly pretty: boolean;
  readonly logFile?: string;
  readonly otelEnabled: boolean;
  readonly otelEndpoint: string;
  readonly otelMetricExportInterval: number;
  readonly logStreamEnabled: boolean;
  readonly logStreamBufferSize: number;
  readonly logStreamHeartbeatMs: number;
  readonly apiDocsEnabled: boolean;
  readonly platformAdmin?: {
    readonly email: string;
    readonly name: string;
    readonly password: string;
  };
  readonly jobsEnabled: boolean;
  readonly jobsPoolMax: number;
  readonly jobsWorkerConcurrency: number;
  readonly bullBoardEnabled: boolean;
  readonly bullBoardBasePath: string;
  readonly bullBoardCsrfSecret: string;
}

export function parseConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = environmentSchema.parse(environment);
  const databaseRuntimeUrl = parsed.DATABASE_RUNTIME_URL ?? parsed.DATABASE_URL;
  if (!databaseRuntimeUrl) throw new Error("DATABASE_RUNTIME_URL or DATABASE_URL is required");
  if (parsed.NODE_ENV === "production" && !parsed.DATABASE_RUNTIME_URL)
    throw new Error("DATABASE_RUNTIME_URL is required in production");
  const adminBootstrap = [
    parsed.PLATFORM_ADMIN_EMAIL,
    parsed.PLATFORM_ADMIN_NAME,
    parsed.PLATFORM_ADMIN_PASSWORD,
  ];
  if (
    adminBootstrap.some((value) => value !== undefined) &&
    adminBootstrap.some((value) => value === undefined)
  )
    throw new Error(
      "PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_NAME and PLATFORM_ADMIN_PASSWORD must be configured together",
    );
  if (
    parsed.BULL_BOARD_ENABLED === "true" &&
    parsed.NODE_ENV === "production" &&
    !parsed.BULL_BOARD_CSRF_SECRET
  )
    throw new Error("BULL_BOARD_CSRF_SECRET is required when Bull Board is enabled in production");
  const defaultLevel: LogLevel =
    parsed.NODE_ENV === "production" ? "info" : parsed.NODE_ENV === "test" ? "silent" : "debug";
  return {
    databaseRuntimeUrl,
    databasePoolMax: parsed.DATABASE_POOL_MAX,
    host: parsed.HOST,
    port: parsed.PORT,
    webOrigin: parsed.WEB_ORIGIN,
    betterAuthSecret: parsed.BETTER_AUTH_SECRET,
    betterAuthUrl: parsed.BETTER_AUTH_URL,
    ...(parsed.WEB_ASSETS_DIR ? { webAssetsDirectory: parsed.WEB_ASSETS_DIR } : {}),
    environment: parsed.NODE_ENV,
    logLevel: parsed.LOG_LEVEL ?? defaultLevel,
    pretty: parsed.LOG_PRETTY === "true" && parsed.NODE_ENV !== "production",
    ...(parsed.LOG_FILE
      ? {
          logFile: isAbsolute(parsed.LOG_FILE)
            ? parsed.LOG_FILE
            : resolve(workspaceRoot, parsed.LOG_FILE),
        }
      : {}),
    otelEnabled: parsed.OTEL_ENABLED ? parsed.OTEL_ENABLED === "true" : parsed.NODE_ENV !== "test",
    otelEndpoint: parsed.OTEL_EXPORTER_OTLP_ENDPOINT,
    otelMetricExportInterval: parsed.OTEL_METRIC_EXPORT_INTERVAL,
    logStreamEnabled: parsed.LOG_STREAM_ENABLED === "true",
    logStreamBufferSize: parsed.LOG_STREAM_BUFFER_SIZE,
    logStreamHeartbeatMs: parsed.LOG_STREAM_HEARTBEAT_MS,
    apiDocsEnabled:
      parsed.API_DOCS_ENABLED === undefined
        ? parsed.NODE_ENV !== "production"
        : parsed.API_DOCS_ENABLED === "true",
    ...(parsed.PLATFORM_ADMIN_EMAIL && parsed.PLATFORM_ADMIN_NAME && parsed.PLATFORM_ADMIN_PASSWORD
      ? {
          platformAdmin: {
            email: parsed.PLATFORM_ADMIN_EMAIL,
            name: parsed.PLATFORM_ADMIN_NAME,
            password: parsed.PLATFORM_ADMIN_PASSWORD,
          },
        }
      : {}),
    jobsEnabled: parsed.JOBS_ENABLED === "true",
    jobsPoolMax: parsed.JOBS_POOL_MAX,
    jobsWorkerConcurrency: parsed.JOBS_WORKER_CONCURRENCY,
    bullBoardEnabled: parsed.BULL_BOARD_ENABLED === "true",
    bullBoardBasePath: parsed.BULL_BOARD_BASE_PATH,
    bullBoardCsrfSecret:
      parsed.BULL_BOARD_CSRF_SECRET ?? "development-bull-board-csrf-secret-change-me",
  };
}

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
  const parsed = jobsWorkerEnvironmentSchema.parse(environment);
  const databaseUrl = parsed.DATABASE_RUNTIME_URL ?? parsed.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("DATABASE_RUNTIME_URL or DATABASE_URL is required for the jobs worker");
  const defaultLevel: LogLevel =
    parsed.NODE_ENV === "production" ? "info" : parsed.NODE_ENV === "test" ? "silent" : "debug";
  return {
    databaseUrl,
    poolMax: parsed.JOBS_POOL_MAX,
    concurrency: parsed.JOBS_WORKER_CONCURRENCY,
    environment: parsed.NODE_ENV,
    logLevel: parsed.LOG_LEVEL ?? defaultLevel,
    pretty: parsed.LOG_PRETTY === "true" && parsed.NODE_ENV !== "production",
  };
}

export function parseMigrationConfig(environment: NodeJS.ProcessEnv = process.env): {
  readonly databaseUrl: string;
} {
  const databaseUrl = z.url().parse(environment.DATABASE_MIGRATOR_URL ?? environment.DATABASE_URL);
  return { databaseUrl };
}

export function parseJobsMigrationConfig(environment: NodeJS.ProcessEnv = process.env): {
  readonly databaseUrl: string;
  readonly runtimeRole: string;
} {
  const { databaseUrl } = parseMigrationConfig(environment);
  const runtimeRole = z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/i)
    .default("app_runtime")
    .parse(environment.DATABASE_RUNTIME_ROLE);
  return { databaseUrl, runtimeRole };
}
