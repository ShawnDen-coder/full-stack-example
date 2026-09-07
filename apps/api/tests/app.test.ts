import { configureLogging, getAppLogger } from "@full-stack-example/logging";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

let logger = getAppLogger("test");

beforeAll(async () => {
  await configureLogging({ service: "test", environment: "test", level: "silent", pretty: false });
  logger = getAppLogger("test");
});

describe("API", () => {
  it("returns the health contract when the database is available", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      services: { database: { status: "up" } },
    });
  });

  it("returns a degradation without revealing the database error", async () => {
    const app = createApp({
      checkDatabase: async () => {
        throw new Error("postgres password");
      },
      logger,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/health");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("postgres password");
  });

  it("returns a uniform 404 response", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/unknown");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("preserves a valid inbound request ID", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/health", {
      headers: { "X-Request-ID": "upstream-trace-123" },
    });
    expect(response.headers.get("X-Request-ID")).toBe("upstream-trace-123");
  });

  it("replaces an invalid inbound request ID", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/health", {
      headers: { "X-Request-ID": "invalid request id" },
    });
    expect(response.headers.get("X-Request-ID")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
  });
});
