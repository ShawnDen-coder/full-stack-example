import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "../src/api-base-url.js";

describe("resolveApiBaseUrl", () => {
  it("uses an explicitly configured API origin", () => {
    expect(resolveApiBaseUrl("http://localhost:3000", "https://example.test")).toBe(
      "http://localhost:3000",
    );
  });

  it("uses the page origin when no API origin is configured", () => {
    expect(resolveApiBaseUrl(undefined, "https://example.test")).toBe("https://example.test");
    expect(resolveApiBaseUrl("", "https://example.test")).toBe("https://example.test");
  });
});
