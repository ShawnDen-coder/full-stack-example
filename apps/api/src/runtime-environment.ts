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
