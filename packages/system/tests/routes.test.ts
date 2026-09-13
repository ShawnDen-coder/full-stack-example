import { Hono } from "hono";
import { hc } from "hono/client";
import { describe, expect, it } from "vitest";
import { type SystemApiType, setupSystemApp } from "../src/index.js";

describe("System RPC route", () => {
  it("can be consumed independently at /health", async () => {
    const app = setupSystemApp(new Hono(), { checkDatabase: async () => {} });
    const client = hc<SystemApiType>("http://localhost", { fetch: app.request.bind(app) });

    const response = await client.health.$get();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });
});
