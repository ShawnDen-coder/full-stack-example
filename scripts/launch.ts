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
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

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
    child.once("error", rejectRun);
    child.once("exit", (code) =>
      code === 0
        ? resolveRun()
        : rejectRun(new Error(`${command} exited with ${code ?? "unknown"}`)),
    );
  });
}

async function preflight(): Promise<void> {
  logger.info(
    { event: "launch.preflight.started", phase: "PREFLIGHT" },
    "Checking local prerequisites",
  );
  if (
    !commandExists(pnpmCommand) ||
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
  await run(pnpmCommand, ["--filter", "@full-stack-example/database", "db:migrate"]);
  try {
    await run(pnpmCommand, ["dev"]);
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
}

main().catch((error: unknown) => {
  logger.error({ err: error, event: "launch.failed" }, "Launcher failed");
  process.exitCode = 1;
});
