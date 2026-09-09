import { describe, expect, it } from "vitest";
import { Hono } from "hono";
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
    app.use("/private", module.guards.requireSession);
    app.get("/private", (context) => context.text("ok"));
    const response = await app.request("http://localhost/private");
    expect(response.status).toBe(401);
  });
});
