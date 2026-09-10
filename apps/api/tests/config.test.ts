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
});
