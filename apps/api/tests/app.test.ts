import { createLogger } from "@full-stack-example/logging";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const logger = createLogger({
  service: "test",
  environment: "test",
  level: "silent",
  pretty: false,
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
});
