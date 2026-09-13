import {
  createPostgresBackend,
  type Job,
  type PostgresQueueBackend,
  Queue,
  type Worker,
} from "bullmq";
import { describe, expect, it } from "vitest";
import { createBullMqJobs } from "../src/bullmq.js";
import type { ExampleJobOutput } from "../src/contracts.js";
import { exampleJob } from "../src/example.js";
import { migrateJobs } from "../src/migration.js";
import { createJobsWorker } from "../src/worker.js";

const runtimeUrl = process.env.DATABASE_RUNTIME_URL ?? process.env.DATABASE_URL;
const migratorUrl = process.env.DATABASE_MIGRATOR_URL ?? process.env.DATABASE_URL;

function createQueue(databaseUrl: string) {
  return new Queue(
    "examples",
    { connection: { connectionString: databaseUrl, schema: "bullmq", max: 5 } },
    createPostgresBackend,
  );
}

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function waitForCompletion(
  worker: Worker<unknown, unknown, string, PostgresQueueBackend>,
  matches: (job: Job<unknown, unknown, string>) => boolean,
) {
  return new Promise<ExampleJobOutput>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("worker completion timeout")), 15_000);
    worker.on("completed", (job) => {
      if (!matches(job)) return;
      clearTimeout(timer);
      resolve(job.returnvalue as ExampleJobOutput);
    });
    worker.on("failed", (job, error) => {
      if (!job || !matches(job)) return;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForFailure(
  worker: Worker<unknown, unknown, string, PostgresQueueBackend>,
  jobId: string,
) {
  return new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("worker failure timeout")), 15_000);
    worker.on("failed", (job) => {
      if (!job || String(job.id) !== jobId) return;
      clearTimeout(timer);
      resolve(job.attemptsMade);
    });
  });
}

describe.skipIf(!runtimeUrl || !migratorUrl)("BullMQ PostgreSQL integration", () => {
  it("runs the official migration repeatedly", async () => {
    await migrateJobs({ databaseUrl: migratorUrl as string, runtimeRole: "app_runtime" });
    await migrateJobs({ databaseUrl: migratorUrl as string, runtimeRole: "app_runtime" });
  });

  it("persists progress and logs through completion", async () => {
    const runtime = await createBullMqJobs({
      databaseUrl: runtimeUrl as string,
      poolMax: 5,
      logger,
    });
    const worker = createJobsWorker({
      databaseUrl: runtimeUrl as string,
      poolMax: 5,
      concurrency: 1,
      definitions: [exampleJob],
      logger,
    });
    const queue = createQueue(runtimeUrl as string);
    try {
      await worker.waitUntilReady();
      const message = `integration-${Date.now()}`;
      const completion = waitForCompletion(
        worker,
        (job) => (job.data as { message?: string }).message === message,
      );
      const reference = await runtime.service.enqueueExample({
        message,
        steps: 3,
        stepDelayMs: 0,
      });
      const result = await completion;
      const job = await queue.getJob(reference.id);
      const logs = await queue.getJobLogs(reference.id);
      expect(result).toMatchObject({ message });
      expect(job?.progress).toBe(100);
      expect(logs.logs).toHaveLength(3);
    } finally {
      await worker.close();
      await queue.close();
      await runtime.close();
    }
  });

  it("retries failed jobs with the configured attempts", async () => {
    const runtime = await createBullMqJobs({
      databaseUrl: runtimeUrl as string,
      poolMax: 5,
      logger,
    });
    const worker = createJobsWorker({
      databaseUrl: runtimeUrl as string,
      poolMax: 5,
      concurrency: 1,
      definitions: [exampleJob],
      logger,
    });
    try {
      await worker.waitUntilReady();
      const referencePromise = runtime.service.enqueueExample({
        message: `integration-fail-${Date.now()}`,
        steps: 2,
        stepDelayMs: 0,
        failAtStep: 1,
      });
      const reference = await referencePromise;
      const failure = await new Promise<{ attemptsMade: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("worker retry timeout")), 15_000);
        worker.on("failed", (job) => {
          if (!job || String(job.id) !== reference.id || job.attemptsMade < 3) return;
          clearTimeout(timer);
          resolve({ attemptsMade: job.attemptsMade });
        });
      });
      expect(failure.attemptsMade).toBe(3);
    } finally {
      await worker.close();
      await runtime.close();
    }
  });

  it("does not retry unregistered jobs or payloads rejected by the schema", async () => {
    const worker = createJobsWorker({
      databaseUrl: runtimeUrl as string,
      poolMax: 5,
      concurrency: 1,
      definitions: [exampleJob],
      logger,
    });
    const queue = createQueue(runtimeUrl as string);
    try {
      await worker.waitUntilReady();
      const cases: readonly (readonly [string, unknown])[] = [
        [`unregistered-${Date.now()}`, {}],
        ["progress-demo", { message: 123 }],
      ];
      for (const [index, [name, data]] of cases.entries()) {
        const jobId = `invalid-${Date.now()}-${index}`;
        const failedAttempts = waitForFailure(worker, jobId);
        await queue.add(name, data, { attempts: 3, jobId });
        await expect(failedAttempts).resolves.toBe(1);
      }
    } finally {
      await worker.close();
      await queue.close();
    }
  });

  it("keeps a waiting job when the producer is restarted", async () => {
    const runtime = await createBullMqJobs({
      databaseUrl: runtimeUrl as string,
      poolMax: 5,
      logger,
    });
    const reference = await runtime.service.enqueueExample({
      message: `integration-restart-${Date.now()}`,
      steps: 1,
      stepDelayMs: 0,
    });
    await runtime.close();

    const worker = createJobsWorker({
      databaseUrl: runtimeUrl as string,
      poolMax: 5,
      concurrency: 1,
      definitions: [exampleJob],
      logger,
    });
    try {
      const completion = waitForCompletion(worker, (job) => String(job.id) === reference.id);
      await worker.waitUntilReady();
      await expect(completion).resolves.toMatchObject({ message: expect.any(String) });
    } finally {
      await worker.close();
    }
  });

  it("exposes native completed metrics", async () => {
    const runtime = await createBullMqJobs({
      databaseUrl: runtimeUrl as string,
      poolMax: 5,
      logger,
    });
    const worker = createJobsWorker({
      databaseUrl: runtimeUrl as string,
      poolMax: 5,
      concurrency: 1,
      definitions: [exampleJob],
      logger,
    });
    const queue = createQueue(runtimeUrl as string);
    try {
      await worker.waitUntilReady();
      const message = `integration-metrics-${Date.now()}`;
      const completion = waitForCompletion(
        worker,
        (job) => (job.data as { message?: string }).message === message,
      );
      await runtime.service.enqueueExample({ message, steps: 1, stepDelayMs: 0 });
      await completion;
      const metrics = await queue.getMetrics("completed", 0, -1);
      expect(metrics.meta.count).toBeGreaterThan(0);
      expect(metrics.data.length).toBeGreaterThan(0);
    } finally {
      await worker.close();
      await queue.close();
      await runtime.close();
    }
  });
});
