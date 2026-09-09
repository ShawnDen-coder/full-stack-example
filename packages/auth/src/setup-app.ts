import type { Env, Hono, Schema } from "hono";
import type { AuthModule } from "./server.js";

export function setupAuthApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: { readonly auth: AuthModule },
) {
  const withStatus = app.get("/api/auth/ok", (context) => context.json({ ok: true }));
  return withStatus.on(["GET", "POST"], "/api/auth/*", (context) => {
    // Admin mutations are exposed only through PlatformAuthService, never as public HTTP routes.
    if (context.req.path.includes("/admin/")) return context.json({ error: "Not found" }, 404);
    return options.auth.auth.handler(context.req.raw);
  });
}
