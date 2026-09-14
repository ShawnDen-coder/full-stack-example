import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAdminProvisionEnvironment } from "../src/config/admin-provision.js";
import { parseApiEnvironment } from "../src/config/api.js";
import { parseJobsWorkerEnvironment } from "../src/config/jobs-worker.js";
import { parseMigrationEnvironment } from "../src/config/migration.js";

const runtimeUrl = "postgres://app_runtime:runtime@localhost:5432/app";
const migratorUrl = "postgres://app_migrator:migrator@localhost:5432/app";
const authSecret = "test-secret-that-is-at-least-32-characters-long";
const apiEnvironment = {
  DATABASE_RUNTIME_URL: runtimeUrl,
  BETTER_AUTH_SECRET: authSecret,
};

describe("process environment schemas", () => {
  it("requires the migrator URL and returns the validated environment shape", () => {
    expect(parseMigrationEnvironment({ DATABASE_MIGRATOR_URL: migratorUrl })).toEqual({
      DATABASE_MIGRATOR_URL: migratorUrl,
    });
    expect(() => parseMigrationEnvironment({ DATABASE_URL: migratorUrl })).toThrow(
      /DATABASE_MIGRATOR_URL: is required/,
    );
  });

  it("requires runtime credentials for API and Worker and strips unrelated secrets", () => {
    expect(() =>
      parseApiEnvironment({ DATABASE_URL: runtimeUrl, BETTER_AUTH_SECRET: authSecret }),
    ).toThrow(/DATABASE_RUNTIME_URL: is required/);
    expect(() => parseJobsWorkerEnvironment({ DATABASE_URL: runtimeUrl })).toThrow(
      /DATABASE_RUNTIME_URL: is required/,
    );

    const worker = parseJobsWorkerEnvironment({
      DATABASE_RUNTIME_URL: runtimeUrl,
      DATABASE_MIGRATOR_URL: migratorUrl,
      PLATFORM_ADMIN_PASSWORD: "must-not-leak",
    });
    expect(worker.DATABASE_RUNTIME_URL).toBe(runtimeUrl);
    expect(worker).not.toHaveProperty("DATABASE_MIGRATOR_URL");
    expect(worker).not.toHaveProperty("PLATFORM_ADMIN_PASSWORD");
  });

  it("coerces and bounds numeric variables", () => {
    expect(parseApiEnvironment({ ...apiEnvironment, PORT: "65535" }).PORT).toBe(65_535);
    expect(parseApiEnvironment({ ...apiEnvironment, PORT: "3000" }).PORT).toBe(3000);
    for (const PORT of ["0", "65536", "3000.5", "not-a-number"]) {
      expect(() => parseApiEnvironment({ ...apiEnvironment, PORT })).toThrow(/PORT:/);
    }
  });

  it("accepts only explicit true/false strings and returns booleans", () => {
    expect(
      parseApiEnvironment({ ...apiEnvironment, LOG_STREAM_ENABLED: "false" }).LOG_STREAM_ENABLED,
    ).toBe(false);
    expect(
      parseApiEnvironment({ ...apiEnvironment, LOG_STREAM_ENABLED: "true" }).LOG_STREAM_ENABLED,
    ).toBe(true);
    for (const LOG_STREAM_ENABLED of ["1", "yes", ""]) {
      expect(() => parseApiEnvironment({ ...apiEnvironment, LOG_STREAM_ENABLED })).toThrow(
        /LOG_STREAM_ENABLED:/,
      );
    }
  });

  it("applies environment-specific defaults inside the parsed result", () => {
    const development = parseApiEnvironment(apiEnvironment);
    expect(development.NODE_ENV).toBe("development");
    expect(development.API_DOCS_ENABLED).toBe(true);
    expect(development.OTEL_ENABLED).toBe(true);
    expect(development.LOG_LEVEL).toBe("debug");
    expect(development.LOG_PRETTY).toBe(true);
    expect(development.BULL_BOARD_ENABLED).toBe(false);

    const test = parseApiEnvironment({ ...apiEnvironment, NODE_ENV: "test" });
    expect(test.API_DOCS_ENABLED).toBe(true);
    expect(test.OTEL_ENABLED).toBe(false);
    expect(test.LOG_LEVEL).toBe("silent");

    const production = parseApiEnvironment({ ...apiEnvironment, NODE_ENV: "production" });
    expect(production.API_DOCS_ENABLED).toBe(false);
    expect(production.OTEL_ENABLED).toBe(true);
    expect(production.LOG_LEVEL).toBe("info");
    expect(production.LOG_PRETTY).toBe(false);

    const overrides = parseApiEnvironment({
      ...apiEnvironment,
      NODE_ENV: "production",
      API_DOCS_ENABLED: "true",
      OTEL_ENABLED: "false",
      LOG_LEVEL: "warn",
      LOG_PRETTY: "true",
    });
    expect(overrides.API_DOCS_ENABLED).toBe(true);
    expect(overrides.OTEL_ENABLED).toBe(false);
    expect(overrides.LOG_LEVEL).toBe("warn");
    expect(overrides.LOG_PRETTY).toBe(false);
  });

  it("resolves a relative log file and requires a production Bull Board CSRF secret", () => {
    const config = parseApiEnvironment({ ...apiEnvironment, LOG_FILE: "logs/api.jsonl" });
    expect(config.LOG_FILE).toContain("logs");
    expect(config.LOG_FILE).toContain("api.jsonl");
    expect(config.LOG_FILE && isAbsolute(config.LOG_FILE)).toBe(true);

    expect(() =>
      parseApiEnvironment({
        ...apiEnvironment,
        NODE_ENV: "production",
        BULL_BOARD_ENABLED: "true",
      }),
    ).toThrow(/BULL_BOARD_CSRF_SECRET: is required/);
    expect(
      parseApiEnvironment({
        ...apiEnvironment,
        NODE_ENV: "production",
        BULL_BOARD_ENABLED: "true",
        BULL_BOARD_CSRF_SECRET: "a-secure-csrf-secret-with-at-least-32-chars",
      }).BULL_BOARD_CSRF_SECRET,
    ).toBe("a-secure-csrf-secret-with-at-least-32-chars");
  });

  it("reports invalid variable names without exposing their values", () => {
    let message = "";
    try {
      parseApiEnvironment({
        DATABASE_RUNTIME_URL: "postgres://private-user:private-password@not a url",
        BETTER_AUTH_SECRET: "private-auth-secret",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("Invalid API environment:");
    expect(message).toContain("DATABASE_RUNTIME_URL:");
    expect(message).toContain("BETTER_AUTH_SECRET:");
    expect(message).not.toContain("private-password");
    expect(message).not.toContain("private-auth-secret");
  });

  it("parses admin provisioning credentials as explicit environment fields", () => {
    const config = parseAdminProvisionEnvironment({
      DATABASE_RUNTIME_URL: runtimeUrl,
      BETTER_AUTH_SECRET: authSecret,
      PLATFORM_ADMIN_EMAIL: "admin@example.com",
      PLATFORM_ADMIN_NAME: "Platform Admin",
      PLATFORM_ADMIN_PASSWORD: "Admin123!",
    });
    expect(config.PLATFORM_ADMIN_EMAIL).toBe("admin@example.com");
    expect(config.PLATFORM_ADMIN_NAME).toBe("Platform Admin");
    expect(config.PLATFORM_ADMIN_PASSWORD).toBe("Admin123!");
    expect(() => parseAdminProvisionEnvironment({ ...apiEnvironment })).toThrow(
      /PLATFORM_ADMIN_EMAIL: is required/,
    );
  });

  it("preserves API database pool and Worker concurrency settings", () => {
    expect(
      parseApiEnvironment({
        ...apiEnvironment,
        DATABASE_POOL_MAX: "24",
        JOBS_POOL_MAX: "18",
      }),
    ).toMatchObject({ DATABASE_POOL_MAX: 24, JOBS_POOL_MAX: 18 });
    expect(
      parseJobsWorkerEnvironment({
        DATABASE_RUNTIME_URL: runtimeUrl,
        JOBS_POOL_MAX: "18",
        JOBS_WORKER_CONCURRENCY: "17",
      }),
    ).toMatchObject({ JOBS_POOL_MAX: 18, JOBS_WORKER_CONCURRENCY: 17 });
  });
});
