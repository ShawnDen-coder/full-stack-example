import { describe, expect, it } from "vitest";
import { type ApiError, parseResponse } from "../src/errors.js";

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
