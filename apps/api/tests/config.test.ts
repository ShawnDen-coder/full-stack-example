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
});
