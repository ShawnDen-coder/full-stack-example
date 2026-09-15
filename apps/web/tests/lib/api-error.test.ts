import { describe, expect, it } from "vitest";
import { type ApiError, throwApiError } from "../src/lib/api-error.js";

describe("throwApiError", () => {
  it("preserves a safe message and request ID from the API response", async () => {
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

  it("uses a status-based message when the response is not JSON", async () => {
    const response = new Response("upstream unavailable", { status: 503 });

    await expect(throwApiError(response)).rejects.toMatchObject({
      status: 503,
      message: "Request failed with status 503",
    });
  });
});

