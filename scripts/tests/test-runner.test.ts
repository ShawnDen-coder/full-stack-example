import { describe, expect, it } from "vitest";
import { createTestRunPlan } from "../test-runner.js";

const databaseEnvironment = {
  DATABASE_URL: "postgres://maintenance:secret@localhost:5432/app",
  DATABASE_RUNTIME_URL: "postgres://runtime:secret@localhost:5432/app",
  DATABASE_MIGRATOR_URL: "postgres://migrator:secret@localhost:5432/app",
  RUN_POSTGRES_INTEGRATION: "true",
  NODE_ENV: "test",
};

describe("test runner plan", () => {
  it("removes database credentials and integration opt-in for unit tests", () => {
    const plan = createTestRunPlan([], databaseEnvironment);
    expect(plan.files).toEqual([]);
    expect(plan.environment).toMatchObject({ NODE_ENV: "test" });
    expect(plan.environment).not.toHaveProperty("DATABASE_URL");
    expect(plan.environment).not.toHaveProperty("DATABASE_RUNTIME_URL");
    expect(plan.environment).not.toHaveProperty("DATABASE_MIGRATOR_URL");
    expect(plan.environment).not.toHaveProperty("RUN_POSTGRES_INTEGRATION");
  });

  it.each([
    ["database", "packages/database/tests/postgres.integration.test.ts"],
    ["auth", "packages/auth/tests/postgres.integration.test.ts"],
    ["jobs", "packages/jobs/tests/postgres.integration.test.ts"],
  ] as const)("selects only the fixed %s integration suite", (suite, file) => {
    const plan = createTestRunPlan(["--postgres", suite], databaseEnvironment);
    expect(plan.files).toEqual([file]);
    expect(plan.environment.RUN_POSTGRES_INTEGRATION).toBe("true");
  });

  it.each([
    ["database", { DATABASE_RUNTIME_URL: databaseEnvironment.DATABASE_RUNTIME_URL }],
    ["database", { DATABASE_URL: databaseEnvironment.DATABASE_URL }],
    ["auth", {}],
    ["jobs", { DATABASE_RUNTIME_URL: databaseEnvironment.DATABASE_RUNTIME_URL }],
    ["jobs", { DATABASE_MIGRATOR_URL: databaseEnvironment.DATABASE_MIGRATOR_URL }],
  ] as const)(
    "rejects %s suite when required database configuration is incomplete",
    (suite, environment) => {
      expect(() => createTestRunPlan(["--postgres", suite], environment)).toThrow(
        `PostgreSQL ${suite} suite requires:`,
      );
    },
  );

  it("rejects unknown suites, extra suite arguments, and unknown options", () => {
    expect(() => createTestRunPlan(["--postgres", "all"], databaseEnvironment)).toThrow("Usage:");
    expect(() =>
      createTestRunPlan(["--postgres", "auth", "some-file.test.ts"], databaseEnvironment),
    ).toThrow("extra arguments are not accepted");
    expect(() => createTestRunPlan(["--unknown"], databaseEnvironment)).toThrow(
      "Unknown test runner option",
    );
  });
});
