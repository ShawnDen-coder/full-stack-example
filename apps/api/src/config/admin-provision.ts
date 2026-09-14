import type { Environment, LogLevel } from "@full-stack-example/logging";
import { z } from "zod";
import { logLevels, resolveLogLevel, resolvePrettyLogging } from "./shared.js";

export interface AdminProvisionConfig {
  readonly databaseRuntimeUrl: string;
  readonly databasePoolMax: number;
  readonly betterAuthSecret: string;
  readonly betterAuthUrl: string;
  readonly webOrigin: string;
  readonly environment: Environment;
  readonly logLevel: LogLevel;
  readonly pretty: boolean;
  readonly platformAdmin: {
    readonly email: string;
    readonly name: string;
    readonly password: string;
  };
}

export function parseAdminProvisionConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AdminProvisionConfig {
  const parsed = z
    .object({
      DATABASE_RUNTIME_URL: z.url(),
      DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
      WEB_ORIGIN: z.url().default("http://localhost:5173"),
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      LOG_LEVEL: z.enum(logLevels).optional(),
      LOG_PRETTY: z.enum(["true", "false"]).default("true"),
      PLATFORM_ADMIN_EMAIL: z.email(),
      PLATFORM_ADMIN_NAME: z.string().min(1),
      PLATFORM_ADMIN_PASSWORD: z.string().min(8),
    })
    .parse(environment);

  return {
    databaseRuntimeUrl: parsed.DATABASE_RUNTIME_URL,
    databasePoolMax: parsed.DATABASE_POOL_MAX,
    betterAuthSecret: parsed.BETTER_AUTH_SECRET,
    betterAuthUrl: parsed.BETTER_AUTH_URL,
    webOrigin: parsed.WEB_ORIGIN,
    environment: parsed.NODE_ENV,
    logLevel: resolveLogLevel(parsed.NODE_ENV, parsed.LOG_LEVEL),
    pretty: resolvePrettyLogging(parsed.NODE_ENV, parsed.LOG_PRETTY),
    platformAdmin: {
      email: parsed.PLATFORM_ADMIN_EMAIL,
      name: parsed.PLATFORM_ADMIN_NAME,
      password: parsed.PLATFORM_ADMIN_PASSWORD,
    },
  };
}
