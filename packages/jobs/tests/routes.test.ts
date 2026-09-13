import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { setupJobsApi } from "../src/routes.js";
import { JobBackendUnavailableError } from "../src/service.js";

describe("jobs API", () => {
  it("validates input and enqueues the example job", async () => {
    const enqueueExample = vi.fn(async () => ({
      id: "job-1",
      name: "progress-demo" as const,
      queueName: "examples" as const,
    }));
    const app = new Hono();
    setupJobsApi(app, { service: { enqueueExample } });

    const response = await app.request("http://localhost/api/admin/jobs/examples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello", steps: 2, stepDelayMs: 0 }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      queueName: "examples",
      name: "progress-demo",
    });
    expect(enqueueExample).toHaveBeenCalledWith({ message: "hello", steps: 2, stepDelayMs: 0 });
  });

  it("rejects invalid job input", async () => {
    const enqueueExample = vi.fn();
    const app = new Hono();
    setupJobsApi(app, { service: { enqueueExample } });

    const response = await app.request("http://localhost/api/admin/jobs/examples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });

    expect(response.status).toBe(400);
    expect(enqueueExample).not.toHaveBeenCalled();
  });

  it("returns 503 for an unavailable job backend", async () => {
    const app = new Hono();
    setupJobsApi(app, {
      service: {
        enqueueExample: vi.fn(async () => {
          throw new JobBackendUnavailableError();
        }),
      },
    });

    const response = await app.request("http://localhost/api/admin/jobs/examples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });

    expect(response.status).toBe(503);
  });
});
