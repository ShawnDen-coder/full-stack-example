import { exampleJob } from "@full-stack-example/jobs";
import { createJobsWorker } from "@full-stack-example/jobs/worker";
import { configureLogging, getAppLogger, shutdownLogging } from "@full-stack-example/logging";
import { parseJobsWorkerEnvironment } from "../config/jobs-worker.js";
import { discardPrivilegedEnvironment, loadWorkspaceEnvironment } from "../runtime/environment.js";

loadWorkspaceEnvironment();
discardPrivilegedEnvironment();

const config = parseJobsWorkerEnvironment();
await configureLogging({
  service: "jobs-worker",
  environment: config.NODE_ENV,
  level: config.LOG_LEVEL,
  pretty: config.LOG_PRETTY,
});
const logger = getAppLogger(["jobs", "worker"]);
const worker = createJobsWorker({
  databaseUrl: config.DATABASE_RUNTIME_URL,
  poolMax: config.JOBS_POOL_MAX,
  concurrency: config.JOBS_WORKER_CONCURRENCY,
  definitions: [exampleJob],
  logger,
});
try {
  await worker.waitUntilReady();
} catch (error) {
  try {
    await worker.close();
  } catch (closeError) {
    logger.error("Jobs worker cleanup failed after startup error", {
      event: "jobs.worker.shutdown.failed",
      error: closeError,
    });
  }
  await shutdownLogging().catch((closeError: unknown) => {
    process.stderr.write(`Jobs worker logging cleanup failed: ${String(closeError)}\n`);
  });
  throw new Error(
    "Could not initialize the Jobs Worker. Run `just infra-up` to provision database and jobs schemas.",
    { cause: error },
  );
}
let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  let failed = false;
  try {
    await worker.close();
  } catch (error) {
    failed = true;
    logger.error("Jobs worker shutdown failed", { event: "jobs.worker.shutdown.failed", error });
  }
  try {
    await shutdownLogging();
  } catch (error) {
    failed = true;
    process.stderr.write(`Jobs worker logging shutdown failed: ${String(error)}\n`);
  }
  if (failed) process.exitCode = 1;
};
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void shutdown());
