import { spawn } from "node:child_process";

const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (
    key.startsWith("PLATFORM_ADMIN_") ||
    key.startsWith("POSTGRES_") ||
    key === "DATABASE_MIGRATOR_URL" ||
    key === "DATABASE_URL"
  )
    delete environment[key];
}

const pnpmCommand =
  process.platform === "win32" ? (process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe") : "pnpm";
const pnpmArgs =
  process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm.cmd", "exec", "concurrently"]
    : ["exec", "concurrently"];
const child = spawn(
  pnpmCommand,
  [
    ...pnpmArgs,
    "--kill-others-on-fail",
    "--names",
    "api,worker,web",
    "pnpm --filter @full-stack-example/api dev",
    "pnpm --filter @full-stack-example/api jobs:worker:dev",
    "pnpm --filter @full-stack-example/web dev",
  ],
  { stdio: "inherit", env: environment, shell: false },
);

let signaled = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    signaled = true;
    child.kill(signal);
  });
}

child.once("error", (error) => {
  process.stderr.write(`Could not start development processes: ${String(error)}\n`);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  if (!signaled && code !== 0) process.exitCode = code ?? 1;
});
