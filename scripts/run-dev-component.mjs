import { spawn } from "node:child_process";

const component = process.argv[2];
const packageScript = {
  api: ["--filter", "@full-stack-example/api", "dev"],
  worker: ["--filter", "@full-stack-example/api", "jobs:worker:dev"],
  web: ["--filter", "@full-stack-example/web", "dev"],
}[component];

if (!packageScript) throw new Error("Expected one of: api, worker, web");

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

const windows = process.platform === "win32";
const command = windows ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
const args = windows ? ["/d", "/s", "/c", "pnpm.cmd", ...packageScript] : packageScript;
const child = spawn(command, args, { env: environment, stdio: "inherit", shell: false });

child.once("error", (error) => {
  process.stderr.write(`Could not start ${component}: ${String(error)}\n`);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
