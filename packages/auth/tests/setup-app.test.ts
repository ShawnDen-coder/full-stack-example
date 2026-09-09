import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { setupAuthApp } from "../src/setup-app.js";

describe("auth app setup", () => {
  it("exposes a deterministic health endpoint", async () => {
    const createUser = vi.fn(async () => ({ id: "user" }));
    const noop: MiddlewareHandler = async (_context, next) => next();
    const auth = {
      auth: { handler: async () => new Response("handled") },
      require: {
        requireSession: noop,
        requirePlatformAdmin: noop,
        requireFreshSession: noop,
      },
      platform: {
        createUser,
        createOrganization: async () => ({ id: "organization" }),
        setOrganizationStatus: async () => undefined,
        requestPasswordReset: async () => undefined,
      },
    } as unknown as Parameters<typeof setupAuthApp>[1]["auth"];
    const app = setupAuthApp(new Hono(), { auth });
    const response = await app.request("http://localhost/api/auth/ok");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const adminResponse = await app.request("http://localhost/api/auth/admin/create-user", {
      method: "POST",
    });
    expect(adminResponse.status).toBe(404);
    const platformResponse = await app.request("http://localhost/api/platform/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", name: "User" }),
    });
    expect(platformResponse.status).toBe(201);
    expect(createUser).toHaveBeenCalledOnce();
  });
});
