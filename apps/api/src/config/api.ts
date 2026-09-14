import type { Environment, LogLevel } from "@full-stack-example/logging";
import { z } from "zod";
import { logLevels, resolveLogFile, resolveLogLevel, resolvePrettyLogging } from "./shared.js";

const environmentSchema = z.object({
  DATABASE_RUNTIME_URL: z.url(),
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
  JOBS_ENABLED: z.enum(["true", "false"]).default("true"),
  JOBS_POOL_MAX: z.coerce.number().int().min(2).max(100).default(10),
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
  readonly jobsEnabled: boolean;
  readonly jobsPoolMax: number;
  readonly bullBoardEnabled: boolean;
  readonly bullBoardBasePath: string;
  readonly bullBoardCsrfSecret: string;
}

export function parseApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = environmentSchema.parse(environment);
  const logFile = resolveLogFile(parsed.LOG_FILE);
  if (
    parsed.BULL_BOARD_ENABLED === "true" &&
    parsed.NODE_ENV === "production" &&
    !parsed.BULL_BOARD_CSRF_SECRET
  )
    throw new Error("BULL_BOARD_CSRF_SECRET is required when Bull Board is enabled in production");

  return {
    databaseRuntimeUrl: parsed.DATABASE_RUNTIME_URL,
    databasePoolMax: parsed.DATABASE_POOL_MAX,
    host: parsed.HOST,
    port: parsed.PORT,
    webOrigin: parsed.WEB_ORIGIN,
    betterAuthSecret: parsed.BETTER_AUTH_SECRET,
    betterAuthUrl: parsed.BETTER_AUTH_URL,
    ...(parsed.WEB_ASSETS_DIR ? { webAssetsDirectory: parsed.WEB_ASSETS_DIR } : {}),
    environment: parsed.NODE_ENV,
    logLevel: resolveLogLevel(parsed.NODE_ENV, parsed.LOG_LEVEL),
    pretty: resolvePrettyLogging(parsed.NODE_ENV, parsed.LOG_PRETTY),
    ...(logFile ? { logFile } : {}),
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
    jobsEnabled: parsed.JOBS_ENABLED === "true",
    jobsPoolMax: parsed.JOBS_POOL_MAX,
    bullBoardEnabled: parsed.BULL_BOARD_ENABLED === "true",
    bullBoardBasePath: parsed.BULL_BOARD_BASE_PATH,
    bullBoardCsrfSecret:
      parsed.BULL_BOARD_CSRF_SECRET ?? "development-bull-board-csrf-secret-change-me",
  };
}
