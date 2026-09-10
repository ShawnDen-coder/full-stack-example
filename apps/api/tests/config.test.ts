import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

describe("API configuration", () => {
  it("resolves a relative log file from the workspace root", () => {
    const config = parseConfig({
      DATABASE_URL: "postgres://app:app@localhost:5432/app",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
      LOG_FILE: "logs/api.jsonl",
    });

    expect(config.logFile).toContain("logs");
    expect(config.logFile).toContain("api.jsonl");
    expect(config.logFile && isAbsolute(config.logFile)).toBe(true);
  });

  it("enables API docs outside production by default", () => {
    const config = parseConfig({
      DATABASE_URL: "postgres://app:app@localhost:5432/app",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
      NODE_ENV: "development",
    });
    expect(config.apiDocsEnabled).toBe(true);
  });

  it("disables API docs in production unless explicitly enabled", () => {
    const environment = {
      DATABASE_URL: "postgres://app:app@localhost:5432/app",
      DATABASE_RUNTIME_URL: "postgres://runtime:runtime@localhost:5432/app",
      DATABASE_MIGRATOR_URL: "postgres://migrator:migrator@localhost:5432/app",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
      NODE_ENV: "production" as const,
    };
    expect(parseConfig(environment).apiDocsEnabled).toBe(false);
    expect(parseConfig({ ...environment, API_DOCS_ENABLED: "true" }).apiDocsEnabled).toBe(true);
    expect(parseConfig({ ...environment, API_DOCS_ENABLED: "false" }).apiDocsEnabled).toBe(false);
  });

  it("allows an explicitly enabled production log stream", () => {
    const environment = {
      DATABASE_URL: "postgres://app:app@localhost:5432/app",
      DATABASE_RUNTIME_URL: "postgres://runtime:runtime@localhost:5432/app",
      DATABASE_MIGRATOR_URL: "postgres://migrator:migrator@localhost:5432/app",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
      NODE_ENV: "production" as const,
      LOG_STREAM_ENABLED: "true" as const,
    };

    expect(parseConfig(environment).logStreamEnabled).toBe(true);
  });

  it("reads the initial platform admin bootstrap credentials", () => {
    const config = parseConfig({
      DATABASE_URL: "postgres://app:app@localhost:5432/app",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
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

  it("rejects partial initial platform admin credentials", () => {
    const base = {
      DATABASE_URL: "postgres://app:app@localhost:5432/app",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
    };
    expect(() => parseConfig({ ...base, PLATFORM_ADMIN_EMAIL: "admin@example.com" })).toThrow(
      "must be configured together",
    );
  });
});
