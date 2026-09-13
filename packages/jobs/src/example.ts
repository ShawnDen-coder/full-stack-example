import type { ExampleJobData, ExampleJobOutput, JobExecutionContext } from "./contracts.js";
import { defineJob } from "./define-job.js";
import { exampleJobSchema } from "./schemas.js";

async function processExampleJob(
  job: JobExecutionContext<ExampleJobData>,
): Promise<ExampleJobOutput> {
  const steps = job.data.steps ?? 10;
  const stepDelayMs = job.data.stepDelayMs ?? 100;
  for (let step = 1; step <= steps; step += 1) {
    if (job.data.failAtStep === step) throw new Error(`Example job failed at step ${step}`);
    if (stepDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, stepDelayMs));
    await job.updateProgress(Math.round((step / steps) * 100));
    await job.log(`Processing example step ${step}/${steps}`);
  }
  return { message: job.data.message, completedAt: new Date().toISOString() };
}

export const exampleJob = defineJob({
  name: "progress-demo",
  input: exampleJobSchema,
  process: processExampleJob,
});
