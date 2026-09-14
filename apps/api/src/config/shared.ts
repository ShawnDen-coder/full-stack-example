import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Environment, LogLevel } from "@full-stack-example/logging";

const workspaceRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const logLevels = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;

export { logLevels };

export function resolveLogFile(path: string | undefined): string | undefined {
  if (!path) return undefined;
  return isAbsolute(path) ? path : resolve(workspaceRoot, path);
}

export function resolveLogLevel(environment: Environment, level?: LogLevel): LogLevel {
  return (
    level ?? (environment === "production" ? "info" : environment === "test" ? "silent" : "debug")
  );
}

export function resolvePrettyLogging(environment: Environment, pretty: string): boolean {
  return pretty === "true" && environment !== "production";
}
