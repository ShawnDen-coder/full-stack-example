import { spawn } from "node:child_process";
import { resolve } from "node:path";

const arguments_ = process.argv.slice(2);
const postgresIntegration = arguments_[0] === "--postgres";
const testFiles = postgresIntegration ? arguments_.slice(1) : arguments_;
const environment = { ...process.env };

if (postgresIntegration) {
  environment.RUN_POSTGRES_INTEGRATION = "true";
} else {
  for (const key of [
    "DATABASE_URL",
    "DATABASE_RUNTIME_URL",
    "DATABASE_MIGRATOR_URL",
    "RUN_POSTGRES_INTEGRATION",
  ])
    delete environment[key];
}

const vitest = resolve(import.meta.dirname, "../node_modules/vitest/vitest.mjs");
const child = spawn(
  process.execPath,
  [vitest, "run", "--config", "vitest.config.ts", ...testFiles],
  { cwd: resolve(import.meta.dirname, ".."), env: environment, stdio: "inherit" },
);

child.once("error", (error) => {
  process.stderr.write(`Could not start Vitest: ${String(error)}\n`);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
