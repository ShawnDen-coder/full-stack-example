import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { configureLogging, getAppLogger, shutdownLogging } from "@full-stack-example/logging";

const root = resolve(import.meta.dirname, "..");
let logger = getAppLogger("launcher");
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

async function waitForCollector(): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://localhost:13133/");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await run("podman", [
    "compose",
    "-f",
    "container/compose.yaml",
    "logs",
    "--tail",
    "100",
    "otel-collector",
  ]);
  throw new Error("OpenTelemetry Collector did not become ready within 60 seconds");
}

function loadEnvironment(): void {
  const envFile = existsSync(resolve(root, ".env")) ? ".env" : ".env.example";
  if (!existsSync(resolve(root, envFile))) throw new Error("Missing .env or .env.example");
  for (const line of readFileSync(resolve(root, envFile), "utf8").split(/\r?\n/u)) {
    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line);
    const key = match?.[1];
    const value = match?.[2];
    if (key && value !== undefined && process.env[key] === undefined) process.env[key] = value;
  }
}

function run(command: string, args: readonly string[]): Promise<void> {
  logger.info("Running command", { event: "launch.command.started", command, args });
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
  logger.info("Checking local prerequisites", {
    event: "launch.preflight.started",
    phase: "PREFLIGHT",
  });
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
  for (const port of [3000, 5173, 5432, 4318, 13133])
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
    "otel-collector",
  ]);
  await waitForCollector();
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

async function entry(): Promise<void> {
  await configureLogging({
    service: "launcher",
    environment: "development",
    level: "debug",
    pretty: true,
  });
  logger = getAppLogger("launcher");
  try {
    await main();
  } catch (error) {
    logger.error("Launcher failed", { error, event: "launch.failed" });
    process.exitCode = 1;
  } finally {
    await shutdownLogging();
  }
}

void entry();
