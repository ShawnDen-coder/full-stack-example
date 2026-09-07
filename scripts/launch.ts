import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createLogger } from "@full-stack-example/logging";

const root = resolve(import.meta.dirname, "..");
const logger = createLogger({
  service: "launcher",
  environment: "development",
  level: "debug",
  pretty: true,
});
const stopInfraOnExit = process.argv.includes("--stop-infra-on-exit");
const doctorOnly = process.argv.includes("--doctor");
const pnpmCommand =
  process.platform === "win32" ? (process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe") : "pnpm";
const pnpmPrefixArgs = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm.cmd"] : [];
let receivedShutdownSignal = false;

function pnpmArgs(args: readonly string[]): readonly string[] {
  return [...pnpmPrefixArgs, ...args];
}

function commandExists(command: string, args: readonly string[] = ["--version"]): boolean {
  return spawnSync(command, args, { cwd: root, stdio: "ignore", shell: false }).status === 0;
}

function portAvailable(port: number): Promise<boolean> {
  return new Promise((resolveAvailable) => {
    const server = createServer();
    server.once("error", () => resolveAvailable(false));
    server.listen(port, () => server.close(() => resolveAvailable(true)));
  });
}

function loadEnvironment(): void {
  const envFile = existsSync(resolve(root, ".env")) ? ".env" : ".env.example";
  if (!existsSync(resolve(root, envFile))) throw new Error("Missing .env or .env.example");
  for (const line of readFileSync(resolve(root, envFile), "utf8").split(/\r?\n/u)) {
    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

function run(command: string, args: readonly string[]): Promise<void> {
  logger.info({ event: "launch.command.started", command, args }, "Running command");
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: false,
      env: process.env,
    });
    const forwardSignal = (signal: NodeJS.Signals) => {
      receivedShutdownSignal = true;
      child.kill(signal);
    };
    process.once("SIGINT", forwardSignal);
    process.once("SIGTERM", forwardSignal);
    const removeSignalHandlers = () => {
      process.removeListener("SIGINT", forwardSignal);
      process.removeListener("SIGTERM", forwardSignal);
    };
    child.once("error", rejectRun);
    child.once("exit", (code) => {
      removeSignalHandlers();
      if (code === 0 || receivedShutdownSignal) resolveRun();
      else rejectRun(new Error(`${command} exited with ${code ?? "unknown"}`));
    });
  });
}

async function preflight(): Promise<void> {
  logger.info(
    { event: "launch.preflight.started", phase: "PREFLIGHT" },
    "Checking local prerequisites",
  );
  if (
    !commandExists(pnpmCommand, pnpmArgs(["--version"])) ||
    !commandExists("podman") ||
    !commandExists("podman", ["compose", "version"])
  ) {
    throw new Error("pnpm, podman, and podman compose must be available");
  }
  if (!commandExists("podman", ["info"]))
    throw new Error("Podman connection is unavailable; run podman machine start");
  loadEnvironment();
  for (const file of ["container/compose.yaml", "packages/database/migrations"]) {
    if (!existsSync(resolve(root, file))) throw new Error(`Missing ${file}`);
  }
  for (const port of [3000, 5173, 5432])
    if (!(await portAvailable(port))) throw new Error(`Port ${port} is already in use`);
}

async function main(): Promise<void> {
  await preflight();
  if (doctorOnly) return;
  await run("podman", [
    "compose",
    "--project-name",
    "full-stack-example",
    "--env-file",
    existsSync(resolve(root, ".env")) ? ".env" : ".env.example",
    "-f",
    "container/compose.yaml",
    "up",
    "-d",
    "--wait",
    "--wait-timeout",
    "60",
    "postgres",
  ]);
  await run(pnpmCommand, pnpmArgs(["--filter", "@full-stack-example/database", "db:migrate"]));
  try {
    await run(
      pnpmCommand,
      pnpmArgs([
        "exec",
        "concurrently",
        "--kill-others-on-fail",
        "--names",
        "api,web",
        "pnpm --filter @full-stack-example/api dev",
        "pnpm --filter @full-stack-example/web dev",
      ]),
    );
  } finally {
    if (stopInfraOnExit)
      await run("podman", [
        "compose",
        "--project-name",
        "full-stack-example",
        "-f",
        "container/compose.yaml",
        "down",
      ]);
  }
  if (receivedShutdownSignal) process.exitCode = 0;
}

main().catch((error: unknown) => {
  logger.error({ err: error, event: "launch.failed" }, "Launcher failed");
  process.exitCode = 1;
});
