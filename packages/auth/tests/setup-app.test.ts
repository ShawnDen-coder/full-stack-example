import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { setupAuthApp } from "../src/setup-app.js";

describe("auth app setup", () => {
  it("exposes a deterministic health endpoint", async () => {
    const auth = { auth: { handler: async () => new Response("handled") } } as any;
    const app = setupAuthApp(new Hono(), { auth });
    const response = await app.request("http://localhost/api/auth/ok");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const adminResponse = await app.request("http://localhost/api/auth/admin/create-user", { method: "POST" });
    expect(adminResponse.status).toBe(404);
  });
});
