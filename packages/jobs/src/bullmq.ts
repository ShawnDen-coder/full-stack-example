import { createPostgresBackend, type PostgresQueueBackend, Queue } from "bullmq";
import type { JobProducer, JobsBoardSource, JobsLogger, JobsRuntime } from "./contracts.js";
import { createJobService, JobBackendUnavailableError } from "./service.js";

export const EXAMPLE_QUEUE_NAME = "examples" as const;

export interface BullMqOptions {
  readonly databaseUrl: string;
  readonly logger: JobsLogger;
  readonly poolMax?: number;
  readonly queueName?: string;
}

function connection(options: BullMqOptions) {
  return {
    connection: {
      connectionString: options.databaseUrl,
      schema: "bullmq",
      max: options.poolMax ?? 10,
    },
  };
}

export async function createBullMqJobs(options: BullMqOptions): Promise<JobsRuntime> {
  const queueName = options.queueName ?? EXAMPLE_QUEUE_NAME;
  const queue = new Queue<unknown, unknown, string, unknown, unknown, string, PostgresQueueBackend>(
    queueName,
    {
      ...connection(options),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: { age: 604_800, count: 5_000 },
      },
    },
    createPostgresBackend,
  );
  queue.on("error", (error) =>
    options.logger.error("BullMQ queue error", {
      event: "jobs.queue.error",
      queueName,
      error,
    }),
  );
  const producer: JobProducer = {
    async enqueue(definition, data) {
      const parsedData = definition.input.parse(data);
      try {
        const job = await queue.add(definition.name, parsedData);
        return { id: String(job.id), name: definition.name, queueName };
      } catch (error) {
        throw new JobBackendUnavailableError(error);
      }
    },
  };
  try {
    await queue.waitUntilReady();
  } catch (error) {
    await queue.close();
    throw error;
  }
  return {
    service: createJobService({ producer }),
    producer,
    board: { queue } as JobsBoardSource,
    close: () => queue.close(),
  };
}

export function createBullMqConnection(options: BullMqOptions) {
  return connection(options);
}
