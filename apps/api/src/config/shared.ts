import type { Environment, LogLevel } from "@full-stack-example/logging";
import { z } from "zod";

export const logLevels = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;

export const sharedEnvironmentShape = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(logLevels).optional(),
  LOG_PRETTY: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value !== "false"),
};

type LoggingEnvironment = {
  readonly NODE_ENV: Environment;
  readonly LOG_LEVEL?: LogLevel | undefined;
  readonly LOG_PRETTY: boolean;
};

export function resolveLoggingEnvironment<T extends LoggingEnvironment>(
  environment: T,
): Omit<T, "LOG_LEVEL" | "LOG_PRETTY"> & {
  readonly LOG_LEVEL: LogLevel;
  readonly LOG_PRETTY: boolean;
} {
  return {
    ...environment,
    LOG_LEVEL:
      environment.LOG_LEVEL ??
      (environment.NODE_ENV === "production"
        ? "info"
        : environment.NODE_ENV === "test"
          ? "silent"
          : "debug"),
    LOG_PRETTY: environment.LOG_PRETTY && environment.NODE_ENV !== "production",
  };
}

export function parseEnvironment<Output>(
  processName: string,
  schema: z.ZodType<Output>,
  source: NodeJS.ProcessEnv,
): Output {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => {
    const name = issue.path.length > 0 ? issue.path.map(String).join(".") : "environment";
    let reason: string;
    switch (issue.code) {
      case "invalid_type":
        reason = issue.input === undefined ? "is required" : `must be ${issue.expected}`;
        break;
      case "invalid_format":
        reason = "has an invalid format";
        break;
      case "too_small":
        reason = `must be at least ${issue.minimum}`;
        break;
      case "too_big":
        reason = `must be at most ${issue.maximum}`;
        break;
      case "invalid_value":
        reason = "has an unsupported value";
        break;
      case "custom":
        reason = issue.message;
        break;
      default:
        reason = "is invalid";
    }
    return `- ${name}: ${reason}`;
  });

  throw new Error(`Invalid ${processName} environment:\n${issues.join("\n")}`);
}
