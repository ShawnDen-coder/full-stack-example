import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exampleJob } from "@full-stack-example/jobs";
import { createJobsWorker } from "@full-stack-example/jobs/worker";
import { configureLogging, getAppLogger, shutdownLogging } from "@full-stack-example/logging";
import { parseJobsWorkerConfig } from "./config.js";

const environmentFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const config = parseJobsWorkerConfig();
await configureLogging({
  service: "jobs-worker",
  environment: config.environment,
  level: config.logLevel,
  pretty: config.pretty,
});
const logger = getAppLogger(["jobs", "worker"]);
const worker = createJobsWorker({
  databaseUrl: config.databaseUrl,
  poolMax: config.poolMax,
  concurrency: config.concurrency,
  definitions: [exampleJob],
  logger,
});
try {
  await worker.waitUntilReady();
} catch (error) {
  await worker.close();
  await shutdownLogging();
  throw error;
}
let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  await worker.close();
  await shutdownLogging();
};
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => void shutdown().finally(() => process.exit(0)));
