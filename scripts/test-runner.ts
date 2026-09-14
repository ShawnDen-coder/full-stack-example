export type PostgresSuite = "database" | "auth" | "jobs";

export interface TestRunPlan {
  readonly files: readonly string[];
  readonly environment: NodeJS.ProcessEnv;
}

const postgresSuites: Record<
  PostgresSuite,
  { readonly file: string; readonly requiredEnvironment: readonly string[] }
> = {
  database: {
    file: "packages/database/tests/postgres.integration.test.ts",
    requiredEnvironment: ["DATABASE_URL", "DATABASE_RUNTIME_URL"],
  },
  auth: {
    file: "packages/auth/tests/postgres.integration.test.ts",
    requiredEnvironment: ["DATABASE_RUNTIME_URL"],
  },
  jobs: {
    file: "packages/jobs/tests/postgres.integration.test.ts",
    requiredEnvironment: ["DATABASE_RUNTIME_URL", "DATABASE_MIGRATOR_URL"],
  },
};

const databaseEnvironmentKeys = [
  "DATABASE_URL",
  "DATABASE_RUNTIME_URL",
  "DATABASE_MIGRATOR_URL",
] as const;

function unitTestEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const environment = { ...source };
  for (const key of [...databaseEnvironmentKeys, "RUN_POSTGRES_INTEGRATION"])
    delete environment[key];
  return environment;
}

function postgresTestEnvironment(
  suite: PostgresSuite,
  source: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const spec = postgresSuites[suite];
  const missing = spec.requiredEnvironment.filter((key) => !source[key]?.trim());
  if (missing.length) throw new Error(`PostgreSQL ${suite} suite requires: ${missing.join(", ")}`);

  const environment = unitTestEnvironment(source);
  for (const key of spec.requiredEnvironment) environment[key] = source[key];
  environment.RUN_POSTGRES_INTEGRATION = "true";
  return environment;
}

export function createTestRunPlan(
  args: readonly string[],
  sourceEnvironment: NodeJS.ProcessEnv,
): TestRunPlan {
  const [mode, suite, ...extra] = args;
  if (mode === "--postgres") {
    if (suite !== "database" && suite !== "auth" && suite !== "jobs")
      throw new Error("Usage: just <suite>-test-integration, or --postgres <database|auth|jobs>");
    if (extra.length)
      throw new Error(
        "PostgreSQL suite is fixed to its integration test file; extra arguments are not accepted",
      );
    const spec = postgresSuites[suite];
    return {
      files: [spec.file],
      environment: postgresTestEnvironment(suite, sourceEnvironment),
    };
  }

  if (mode?.startsWith("--")) throw new Error(`Unknown test runner option: ${mode}`);
  return { files: args, environment: unitTestEnvironment(sourceEnvironment) };
}
