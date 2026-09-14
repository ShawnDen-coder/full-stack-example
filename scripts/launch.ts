import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { configureLogging, getAppLogger, shutdownLogging } from "../packages/logging/src/index.js";

const root = resolve(import.meta.dirname, "..");
let logger = getAppLogger("launcher");
const stopInfraOnExit = process.argv.includes("--stop-infra-on-exit");
const doctorOnly = process.argv.includes("--doctor");
const pnpmCommand =
  process.platform === "win32" ? (process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe") : "pnpm";
const pnpmPrefixArgs = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm.cmd"] : [];
let receivedShutdownSignal = false;
let currentPhase = "preflight";

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
  const envFile = resolve(root, ".env");
  if (!existsSync(envFile))
    throw new Error("Missing .env. Create it with `Copy-Item .env.example .env`.");
  process.loadEnvFile(envFile);
}

function run(
  command: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
  signalIsSuccess = false,
): Promise<void> {
  logger.info("Running command", { event: "launch.command.started", command, args });
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: false,
      env: environment,
    });
    let settled = false;
    const forwardSignal = (signal: NodeJS.Signals) => {
      receivedShutdownSignal = true;
      child.kill(signal);
    };
    process.once("SIGINT", forwardSignal);
    process.once("SIGTERM", forwardSignal);
    const cleanup = () => {
      process.removeListener("SIGINT", forwardSignal);
      process.removeListener("SIGTERM", forwardSignal);
    };
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectRun(error);
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (code === 0 || (receivedShutdownSignal && signalIsSuccess)) resolveRun();
      else rejectRun(new Error(`${command} exited with ${code ?? "unknown"}`));
    });
  });
}

async function preflight(): Promise<void> {
  logger.info("Checking local prerequisites", {
    event: "launch.preflight.started",
    phase: "preflight",
  });
  if (
    !commandExists(pnpmCommand, pnpmArgs(["--version"])) ||
    !commandExists("just") ||
    !commandExists("podman") ||
    !commandExists("podman", ["compose", "version"])
  )
    throw new Error("pnpm, just, podman, and podman compose must be available");
  if (!commandExists("podman", ["info"]))
    throw new Error("Podman connection is unavailable; run podman machine start");
  loadEnvironment();
  for (const file of ["container/compose.yaml", "packages/database/migrations"]) {
    if (!existsSync(resolve(root, file))) throw new Error(`Missing ${file}`);
  }
  for (const port of [3000, 5173])
    if (!(await portAvailable(port))) throw new Error(`Development port ${port} is already in use`);
}

async function main(): Promise<void> {
  currentPhase = "preflight";
  await preflight();
  if (doctorOnly) return;

  try {
    currentPhase = "infrastructure provisioning";
    await run("just", ["infra-up"]);
    currentPhase = "API, Worker, and Web development processes";
    await run(
      pnpmCommand,
      pnpmArgs(["exec", "tsx", "scripts/dev-processes.ts"]),
      process.env,
      true,
    );
  } finally {
    if (stopInfraOnExit) await run("just", ["infra-down"]);
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
    logger.error("Launcher failed", {
      error,
      phase: currentPhase,
      event: "launch.failed",
    });
    process.exitCode = 1;
  } finally {
    await shutdownLogging();
  }
}

void entry();
