import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/client.js";
import { type ApiError, throwApiError } from "../src/errors.js";

describe("throwApiError", () => {
  it("normalizes an unexpected HTTP failure", async () => {
    const response = new Response(JSON.stringify({ error: "Bad gateway" }), {
      status: 502,
      headers: { "X-Request-ID": "request-1" },
    });
    await expect(throwApiError(response)).rejects.toMatchObject({
      status: 502,
      message: "Bad gateway",
      requestId: "request-1",
    } satisfies Partial<ApiError>);
  });
});

describe("createApiClient", () => {
  it("sends requests through the host's transport with its credentials policy", async () => {
    const app = new Hono().get("/health", (c) => c.json({ status: "ok" }));
    const fetch = vi.fn(async () => new Response('{"status":"ok"}'));
    const client = createApiClient<typeof app>("https://example.test", {
      fetch,
      init: { credentials: "include" },
    });
    expect(await (await client.health.$get()).json()).toEqual({ status: "ok" });
    expect(fetch).toHaveBeenCalledWith(
      "https://example.test/health",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
