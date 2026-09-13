import { describe, expect, it, vi } from "vitest";
import type { ExampleJobData, JobExecutionContext } from "../src/contracts.js";
import { exampleJob } from "../src/example.js";

function createJob(data: ExampleJobData) {
  const updateProgress = vi.fn(async () => undefined);
  const log = vi.fn(async () => undefined);
  const job = {
    id: "job-1",
    data,
    updateProgress,
    log,
  };
  return job satisfies JobExecutionContext<ExampleJobData>;
}

describe("exampleJob", () => {
  it("reports progress and logs each completed step", async () => {
    const job = createJob({ message: "hello", steps: 3, stepDelayMs: 0 });

    await expect(exampleJob.process(job)).resolves.toMatchObject({ message: "hello" });
    expect(job.updateProgress).toHaveBeenNthCalledWith(1, 33);
    expect(job.updateProgress).toHaveBeenNthCalledWith(2, 67);
    expect(job.updateProgress).toHaveBeenNthCalledWith(3, 100);
    expect(job.log).toHaveBeenCalledTimes(3);
    expect(job.log).toHaveBeenLastCalledWith("Processing example step 3/3");
  });

  it("fails at the configured step without reporting it as completed", async () => {
    const job = createJob({ message: "hello", steps: 3, stepDelayMs: 0, failAtStep: 2 });

    await expect(exampleJob.process(job)).rejects.toThrow("Example job failed at step 2");
    expect(job.updateProgress).toHaveBeenCalledTimes(1);
    expect(job.log).toHaveBeenCalledTimes(1);
  });
});
