import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createTestRunPlan } from "./test-runner.js";

let plan: ReturnType<typeof createTestRunPlan> | undefined;
try {
  plan = createTestRunPlan(process.argv.slice(2), process.env);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}

if (plan) {
  const vitest = resolve(import.meta.dirname, "../node_modules/vitest/vitest.mjs");
  const child = spawn(
    process.execPath,
    [vitest, "run", "--config", "vitest.config.ts", ...plan.files],
    { cwd: resolve(import.meta.dirname, ".."), env: plan.environment, stdio: "inherit" },
  );

  child.once("error", (error) => {
    process.stderr.write(`Could not start Vitest: ${String(error)}\n`);
    process.exitCode = 1;
  });
  child.once("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
