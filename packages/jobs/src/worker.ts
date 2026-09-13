import {
  createPostgresBackend,
  MetricsTime,
  type PostgresQueueBackend,
  UnrecoverableError,
  Worker,
} from "bullmq";
import { type BullMqOptions, createBullMqConnection, EXAMPLE_QUEUE_NAME } from "./bullmq.js";
import type { AnyJobDefinition, JobExecutionContext } from "./contracts.js";

type WorkerOptions = BullMqOptions & {
  readonly concurrency?: number;
  readonly definitions: readonly AnyJobDefinition[];
};

interface QueueJobLike {
  readonly id?: string | undefined;
  readonly name: string;
  readonly data: unknown;
  readonly attemptsMade: number;
  updateProgress(progress: number | object): Promise<unknown>;
  log(message: string): Promise<unknown>;
}

type JobHandler = (job: QueueJobLike) => Promise<unknown>;

export function createJobProcessor(definitions: readonly AnyJobDefinition[]): JobHandler {
  const handlers = new Map<string, JobHandler>();
  for (const definition of definitions) {
    if (handlers.has(definition.name))
      throw new Error(`Duplicate job definition registered: ${definition.name}`);
    handlers.set(definition.name, async (job) => {
      let data: unknown;
      try {
        data = definition.input.parse(job.data);
      } catch {
        throw new UnrecoverableError(`Invalid payload for job ${definition.name}`);
      }
      return definition.process({
        id: String(job.id),
        data,
        attempt: job.attemptsMade,
        updateProgress: (progress) => job.updateProgress(progress),
        log: (message) => job.log(message),
      } as JobExecutionContext<never>);
    });
  }

  return async (job) => {
    const handler = handlers.get(job.name);
    if (!handler) throw new UnrecoverableError(`No job definition registered for ${job.name}`);
    return handler(job);
  };
}

export function createJobsWorker(options: WorkerOptions) {
  const queueName = options.queueName ?? EXAMPLE_QUEUE_NAME;
  const worker = new Worker<unknown, unknown, string, PostgresQueueBackend>(
    queueName,
    createJobProcessor(options.definitions),
    {
      ...createBullMqConnection(options),
      concurrency: options.concurrency ?? 2,
      metrics: { maxDataPoints: MetricsTime.ONE_WEEK },
    },
    createPostgresBackend,
  );
  worker.on("error", (error) =>
    options.logger.error("BullMQ worker error", {
      event: "jobs.worker.error",
      queueName,
      error,
    }),
  );
  worker.on("failed", (job, error) =>
    options.logger.error("BullMQ job failed", {
      event: "jobs.job.failed",
      queueName,
      jobId: job?.id,
      jobName: job?.name,
      error,
    }),
  );
  worker.on("completed", (job) =>
    options.logger.info("BullMQ job completed", {
      event: "jobs.job.completed",
      queueName,
      jobId: job.id,
      jobName: job.name,
    }),
  );
  worker.on("stalled", (jobId) =>
    options.logger.warn("BullMQ job stalled", {
      event: "jobs.job.stalled",
      queueName,
      jobId,
    }),
  );
  return worker;
}
