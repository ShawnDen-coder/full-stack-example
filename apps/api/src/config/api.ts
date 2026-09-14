import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { parseEnvironment, resolveLoggingEnvironment, sharedEnvironmentShape } from "./shared.js";

const workspaceRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const booleanEnvironmentValue = z.enum(["true", "false"]).transform((value) => value === "true");

export const apiEnvironmentSchema = z
  .object({
    ...sharedEnvironmentShape,
    DATABASE_RUNTIME_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    WEB_ORIGIN: z.url().default("http://localhost:5173"),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    WEB_ASSETS_DIR: z.string().min(1).optional(),
    LOG_FILE: z
      .string()
      .min(1)
      .optional()
      .transform((path) =>
        path ? (isAbsolute(path) ? path : resolve(workspaceRoot, path)) : undefined,
      ),
    OTEL_ENABLED: booleanEnvironmentValue.optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().default("http://localhost:4318"),
    OTEL_METRIC_EXPORT_INTERVAL: z.coerce.number().int().min(1000).default(10_000),
    LOG_STREAM_ENABLED: booleanEnvironmentValue.optional(),
    LOG_STREAM_BUFFER_SIZE: z.coerce.number().int().min(1).max(10_000).default(1000),
    LOG_STREAM_HEARTBEAT_MS: z.coerce.number().int().min(1000).default(15_000),
    API_DOCS_ENABLED: booleanEnvironmentValue.optional(),
    JOBS_ENABLED: booleanEnvironmentValue.optional(),
    JOBS_POOL_MAX: z.coerce.number().int().min(2).max(100).default(10),
    BULL_BOARD_ENABLED: booleanEnvironmentValue.optional(),
    BULL_BOARD_BASE_PATH: z
      .string()
      .regex(/^\/[a-zA-Z0-9/_-]+$/)
      .default("/admin/queues"),
    BULL_BOARD_CSRF_SECRET: z.string().min(32).optional(),
  })
  .superRefine((environment, context) => {
    if (
      environment.BULL_BOARD_ENABLED &&
      environment.NODE_ENV === "production" &&
      !environment.BULL_BOARD_CSRF_SECRET
    ) {
      context.addIssue({
        code: "custom",
        path: ["BULL_BOARD_CSRF_SECRET"],
        message: "is required when Bull Board is enabled in production",
      });
    }
  })
  .transform((environment) => ({
    ...environment,
    ...resolveLoggingEnvironment(environment),
    LOG_STREAM_ENABLED: environment.LOG_STREAM_ENABLED ?? false,
    JOBS_ENABLED: environment.JOBS_ENABLED ?? true,
    BULL_BOARD_ENABLED: environment.BULL_BOARD_ENABLED ?? false,
    OTEL_ENABLED: environment.OTEL_ENABLED ?? environment.NODE_ENV !== "test",
    API_DOCS_ENABLED: environment.API_DOCS_ENABLED ?? environment.NODE_ENV !== "production",
    BULL_BOARD_CSRF_SECRET:
      environment.BULL_BOARD_CSRF_SECRET ?? "development-bull-board-csrf-secret-change-me",
  }));

export type ApiEnvironment = z.output<typeof apiEnvironmentSchema>;

export function parseApiEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  return parseEnvironment("API", apiEnvironmentSchema, source);
}
