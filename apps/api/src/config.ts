import { z } from "zod";
import type { Environment, LogLevel } from "@full-stack-example/logging";

const logLevels = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;
const environmentSchema = z.object({
  DATABASE_URL: z.url(),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z.url().default("http://localhost:5173"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(logLevels).optional(),
  LOG_PRETTY: z.enum(["true", "false"]).default("true"),
});

export interface ApiConfig {
  readonly databaseUrl: string;
  readonly host: string;
  readonly port: number;
  readonly webOrigin: string;
  readonly environment: Environment;
  readonly logLevel: LogLevel;
  readonly pretty: boolean;
}

export function parseConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = environmentSchema.parse(environment);
  const defaultLevel: LogLevel =
    parsed.NODE_ENV === "production" ? "info" : parsed.NODE_ENV === "test" ? "silent" : "debug";
  return {
    databaseUrl: parsed.DATABASE_URL,
    host: parsed.HOST,
    port: parsed.PORT,
    webOrigin: parsed.WEB_ORIGIN,
    environment: parsed.NODE_ENV,
    logLevel: parsed.LOG_LEVEL ?? defaultLevel,
    pretty: parsed.LOG_PRETTY === "true" && parsed.NODE_ENV !== "production",
  };
}
