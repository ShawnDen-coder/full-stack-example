import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createAuthModule } from "../src/server.js";

describe("auth guards", () => {
  it("returns 401 when no session is present", async () => {
    const module = createAuthModule({
      database: {} as any,
      baseURL: "http://localhost:3000",
      secret: "test-secret-that-is-at-least-32-characters-long",
      trustedOrigins: ["http://localhost:5173"],
    });
    (module.auth as any).api.getSession = async () => null;
    const app = new Hono();
    app.use("/private", module.require.requireSession);
    app.get("/private", (context) => context.text("ok"));
    const response = await app.request("http://localhost/private");
    expect(response.status).toBe(401);
  });

  it("fails closed when there is no active organization", async () => {
    const database = {
      query: { member: { findFirst: vi.fn() }, organization: { findFirst: vi.fn() } },
    } as any;
    const module = createAuthModule({
      database,
      baseURL: "http://localhost:3000",
      secret: "test-secret-that-is-at-least-32-characters-long",
      trustedOrigins: [],
    });
    const getSession = vi.fn(async () => ({
      user: { id: "u1", role: "user" },
      session: { id: "s1", activeOrganizationId: null },
    }));
    (module.auth as any).api.getSession = getSession;
    const app = new Hono();
    app.use(
      "/private",
      module.require.requireTenantPermission({ resource: "todos", action: "read" }),
    );
    app.get("/private", (context) => context.text("ok"));
    const response = await app.request("http://localhost/private");
    expect(response.status).toBe(400);
    expect(getSession).toHaveBeenCalledOnce();
  });

  it("does not treat a platform admin as a tenant member", async () => {
    const database = {
      query: {
        member: { findFirst: vi.fn(async () => undefined) },
        organization: { findFirst: vi.fn(async () => ({ id: "org", status: "active" })) },
      },
    } as any;
    const module = createAuthModule({
      database,
      baseURL: "http://localhost:3000",
      secret: "test-secret-that-is-at-least-32-characters-long",
      trustedOrigins: [],
      policy: { roles: { owner: { todos: ["read"] }, admin: {}, member: {} } },
    });
    (module.auth as any).api.getSession = async () => ({
      user: { id: "u1", role: "platform-admin" },
      session: { id: "s1", activeOrganizationId: "org" },
    });
    const app = new Hono();
    app.use(
      "/private",
      module.require.requireTenantPermission({ resource: "todos", action: "read" }),
    );
    app.get("/private", (context) => context.text("ok"));
    const response = await app.request("http://localhost/private");
    expect(response.status).toBe(403);
  });
});
