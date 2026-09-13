import { describe, expect, it, vi } from "vitest";
import type { JobProducer } from "../src/contracts.js";
import { exampleJob } from "../src/example.js";
import { createJobService } from "../src/service.js";

describe("createJobService", () => {
  it("delegates to the injected producer", async () => {
    const producer = {
      enqueue: vi.fn(async (definition: { readonly name: string }, _data: unknown) => ({
        id: "job-1",
        name: definition.name,
        queueName: "examples",
      })),
    } as unknown as JobProducer;
    const service = createJobService({ producer });
    const input = { message: "hello", steps: 1, stepDelayMs: 0 };

    await expect(service.enqueueExample(input)).resolves.toEqual({
      id: "job-1",
      name: "progress-demo",
      queueName: "examples",
    });
    expect(producer.enqueue).toHaveBeenCalledWith(exampleJob, input);
  });
});
