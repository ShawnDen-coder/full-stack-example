import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Environment, LogLevel } from "@full-stack-example/logging";
import { z } from "zod";

const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const logLevels = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;
const environmentSchema = z.object({
  DATABASE_URL: z.url(),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z.url().default("http://localhost:5173"),
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
});

export interface ApiConfig {
  readonly databaseUrl: string;
  readonly host: string;
  readonly port: number;
  readonly webOrigin: string;
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
}

export function parseConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = environmentSchema.parse(environment);
  const defaultLevel: LogLevel =
    parsed.NODE_ENV === "production" ? "info" : parsed.NODE_ENV === "test" ? "silent" : "debug";
  if (parsed.LOG_STREAM_ENABLED === "true" && parsed.NODE_ENV === "production")
    throw new Error("LOG_STREAM_ENABLED requires authentication before production use");
  return {
    databaseUrl: parsed.DATABASE_URL,
    host: parsed.HOST,
    port: parsed.PORT,
    webOrigin: parsed.WEB_ORIGIN,
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
  };
}
