import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { setupAuthApp } from "../src/route.js";

describe("auth app setup", () => {
  it("exposes a deterministic health endpoint", async () => {
    const createOrganization = vi.fn(async () => ({ id: "organization" }));
    const noop: MiddlewareHandler = async (context, next) => {
      context.set("sessionPrincipal", {
        userId: "admin",
        sessionId: "session",
        platformRole: "platform-admin",
      });
      return next();
    };
    const auth = {
      auth: { handler: async () => new Response("handled") },
      require: {
        requireSession: noop,
        requirePlatformAdmin: noop,
        requireFreshSession: noop,
      },
      platform: {
        createOrganization,
        setOrganizationStatus: async () => undefined,
      },
    } as unknown as Parameters<typeof setupAuthApp>[1]["auth"];
    const app = setupAuthApp(new Hono(), { auth });
    const response = await app.request("http://localhost/api/auth/ok");
    expect(response.status).toBe(404);
    const resetResponse = await app.request("http://localhost/api/auth/request-password-reset", {
      method: "POST",
    });
    expect(resetResponse.status).toBe(410);
    await expect(resetResponse.json()).resolves.toEqual({
      error: "Email delivery is not configured",
      code: "EMAIL_DISABLED",
    });
    const verificationResponse = await app.request(
      "http://localhost/api/auth/send-verification-email",
      { method: "POST" },
    );
    expect(verificationResponse.status).toBe(410);
    const platformResponse = await app.request("http://localhost/api/platform/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", name: "User" }),
    });
    expect(platformResponse.status).toBe(404);
    expect(createOrganization).not.toHaveBeenCalled();
  });
});
