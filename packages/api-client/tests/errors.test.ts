import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/client.js";
import { type ApiError, parseResponse } from "../src/errors.js";

afterEach(() => vi.unstubAllGlobals());

describe("parseResponse", () => {
  it("normalizes an unexpected HTTP failure", async () => {
    const response = new Response(JSON.stringify({ error: "Bad gateway" }), {
      status: 502,
      headers: { "X-Request-ID": "request-1" },
    });
    await expect(parseResponse(response)).rejects.toMatchObject({
      status: 502,
      message: "Bad gateway",
      requestId: "request-1",
    } satisfies Partial<ApiError>);
  });
});

describe("createApiClient", () => {
  it("includes credentials in API requests", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await createApiClient("https://example.test").health.$get();
    expect(fetch).toHaveBeenCalledWith(
      "https://example.test/health",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
