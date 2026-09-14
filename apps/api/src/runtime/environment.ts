import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const workspaceEnvironmentFile = fileURLToPath(new URL("../../../../.env", import.meta.url));

export function loadWorkspaceEnvironment(environmentFile = workspaceEnvironmentFile): void {
  if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);
}

export function discardPrivilegedEnvironment(): void {
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("PLATFORM_ADMIN_") ||
      key.startsWith("POSTGRES_") ||
      key === "DATABASE_MIGRATOR_URL" ||
      key === "DATABASE_URL"
    )
      delete process.env[key];
  }
}
