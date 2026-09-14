import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseAdminProvisionConfig,
  parseConfig,
  parseJobsMigrationConfig,
  parseJobsWorkerConfig,
  parseMigrationConfig,
} from "../src/config.js";

const runtimeUrl = "postgres://app_runtime:runtime@localhost:5432/app";
const migratorUrl = "postgres://app_migrator:migrator@localhost:5432/app";
const authSecret = "test-secret-that-is-at-least-32-characters-long";

describe("API configuration", () => {
  it("requires a migrator URL for all migration entrypoints", () => {
    expect(parseMigrationConfig({ DATABASE_MIGRATOR_URL: migratorUrl })).toEqual({
      databaseUrl: migratorUrl,
    });
    expect(parseJobsMigrationConfig({ DATABASE_MIGRATOR_URL: migratorUrl })).toEqual({
      databaseUrl: migratorUrl,
    });
    expect(() => parseMigrationConfig({ DATABASE_URL: migratorUrl })).toThrow();
    expect(() => parseJobsMigrationConfig({ DATABASE_URL: migratorUrl })).toThrow();
  });

  it("requires the runtime URL for API and Worker", () => {
    expect(() =>
      parseConfig({ DATABASE_URL: runtimeUrl, BETTER_AUTH_SECRET: authSecret }),
    ).toThrow();
    expect(() => parseJobsWorkerConfig({ DATABASE_URL: runtimeUrl })).toThrow();
    expect(parseJobsWorkerConfig({ DATABASE_RUNTIME_URL: runtimeUrl }).databaseUrl).toBe(
      runtimeUrl,
    );
  });

  it("resolves a relative log file from the workspace root", () => {
    const config = parseConfig({
      DATABASE_RUNTIME_URL: runtimeUrl,
      BETTER_AUTH_SECRET: authSecret,
      LOG_FILE: "logs/api.jsonl",
    });

    expect(config.logFile).toContain("logs");
    expect(config.logFile).toContain("api.jsonl");
    expect(config.logFile && isAbsolute(config.logFile)).toBe(true);
  });

  it("enables API docs outside production by default", () => {
    const config = parseConfig({
      DATABASE_RUNTIME_URL: runtimeUrl,
      BETTER_AUTH_SECRET: authSecret,
      NODE_ENV: "development",
    });
    expect(config.apiDocsEnabled).toBe(true);
    expect(config.databasePoolMax).toBe(10);
  });

  it("accepts a configured API database pool upper bound", () => {
    const config = parseConfig({
      DATABASE_RUNTIME_URL: runtimeUrl,
      DATABASE_POOL_MAX: "24",
      BETTER_AUTH_SECRET: authSecret,
    });
    expect(config.databasePoolMax).toBe(24);
  });

  it("disables API docs in production unless explicitly enabled", () => {
    const environment = {
      DATABASE_RUNTIME_URL: runtimeUrl,
      BETTER_AUTH_SECRET: authSecret,
      NODE_ENV: "production" as const,
    };
    expect(parseConfig(environment).apiDocsEnabled).toBe(false);
    expect(parseConfig({ ...environment, API_DOCS_ENABLED: "true" }).apiDocsEnabled).toBe(true);
    expect(parseConfig({ ...environment, API_DOCS_ENABLED: "false" }).apiDocsEnabled).toBe(false);
  });

  it("allows an explicitly enabled production log stream", () => {
    expect(
      parseConfig({
        DATABASE_RUNTIME_URL: runtimeUrl,
        BETTER_AUTH_SECRET: authSecret,
        NODE_ENV: "production",
        LOG_STREAM_ENABLED: "true",
      }).logStreamEnabled,
    ).toBe(true);
  });

  it("reads initial platform admin credentials in the provision config", () => {
    const config = parseAdminProvisionConfig({
      DATABASE_RUNTIME_URL: runtimeUrl,
      BETTER_AUTH_SECRET: authSecret,
      PLATFORM_ADMIN_EMAIL: "admin@example.com",
      PLATFORM_ADMIN_NAME: "Platform Admin",
      PLATFORM_ADMIN_PASSWORD: "Admin123!",
    });
    expect(config.platformAdmin).toEqual({
      email: "admin@example.com",
      name: "Platform Admin",
      password: "Admin123!",
    });
  });

  it("requires complete admin provisioning credentials", () => {
    expect(() =>
      parseAdminProvisionConfig({
        DATABASE_RUNTIME_URL: runtimeUrl,
        BETTER_AUTH_SECRET: authSecret,
      }),
    ).toThrow();
  });
});
