import type { JobProducer, JobService } from "./contracts.js";
import { exampleJob } from "./example.js";

export class JobBackendUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Job backend unavailable", { cause });
    this.name = "JobBackendUnavailableError";
  }
}

export function createJobService(options: { readonly producer: JobProducer }): JobService {
  return {
    enqueueExample: (input) => options.producer.enqueue(exampleJob, input),
  };
}
