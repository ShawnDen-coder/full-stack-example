import { UnrecoverableError } from "bullmq";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";
import type { JobInput, JobProducer, JobResult } from "../src/contracts.js";
import { defineJob } from "../src/define-job.js";
import { createJobProcessor } from "../src/worker.js";

const customJob = defineJob({
  name: "mail.send",
  input: z.object({ address: z.email(), retries: z.number().default(2) }),
  process: async ({ data }) => ({ accepted: data.address, retries: data.retries }),
});

expectTypeOf(customJob.name).toEqualTypeOf<"mail.send">();
expectTypeOf<Parameters<typeof customJob.process>[0]["data"]>().toEqualTypeOf<{
  address: string;
  retries: number;
}>();
expectTypeOf<JobInput<typeof customJob>>().toEqualTypeOf<{
  address: string;
  retries?: number | undefined;
}>();
expectTypeOf<JobResult<typeof customJob>>().toEqualTypeOf<{
  accepted: string;
  retries: number;
}>();

function checkProducerTypes(producer: JobProducer) {
  producer.enqueue(customJob, { address: "user@example.com" });
  // @ts-expect-error The definition schema rejects non-string addresses.
  producer.enqueue(customJob, { address: 123 });
}
void checkProducerTypes;

function fakeJob(name: string, data: unknown) {
  return {
    id: "job-1",
    name,
    data,
    attemptsMade: 1,
    updateProgress: vi.fn(async () => undefined),
    log: vi.fn(async () => undefined),
  };
}

describe("job definition dispatch", () => {
  it("validates and normalizes payloads before invoking the matching definition", async () => {
    const process = vi.fn(customJob.process);
    const processor = createJobProcessor([{ ...customJob, process }]);
    const job = fakeJob("mail.send", { address: "user@example.com" });

    await expect(processor(job)).resolves.toEqual({
      accepted: "user@example.com",
      retries: 2,
    });
    expect(process).toHaveBeenCalledWith(
      expect.objectContaining({ data: { address: "user@example.com", retries: 2 } }),
    );
  });

  it("rejects duplicate names before worker startup", () => {
    expect(() => createJobProcessor([customJob, customJob])).toThrow(
      "Duplicate job definition registered: mail.send",
    );
  });

  it("fails unknown jobs without retrying", async () => {
    const processor = createJobProcessor([customJob]);

    await expect(processor(fakeJob("mail.unknown", {}))).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it("fails invalid payloads without calling the handler or retrying", async () => {
    const process = vi.fn(customJob.process);
    const processor = createJobProcessor([{ ...customJob, process }]);

    await expect(processor(fakeJob("mail.send", { address: "not-an-email" }))).rejects.toThrow(
      "Invalid payload for job mail.send",
    );
    expect(process).not.toHaveBeenCalled();
  });
});
