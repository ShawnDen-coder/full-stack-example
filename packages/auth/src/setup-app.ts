import { zValidator } from "@hono/zod-validator";
import type { Env, Hono, Schema } from "hono";
import { z } from "zod";
import type { AuthVariables, SessionPrincipal } from "./contracts.js";
import type { AuthModule } from "./server.js";

const userInput = z.object({ email: z.string().email(), name: z.string().trim().min(1).max(200) });
const organizationInput = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(100),
  ownerUserId: z.string().min(1),
});
const statusInput = z.object({ status: z.enum(["active", "disabled"]) });
type PlatformContext = import("hono").Context<{ Variables: AuthVariables }>;

export function setupAuthApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: { readonly auth: AuthModule },
) {
  const platformGuards = [
    options.auth.require.requireSession,
    options.auth.require.requirePlatformAdmin,
    options.auth.require.requireFreshSession,
  ] as const;
  const withPlatform = app
    .post(
      "/api/platform/users",
      ...platformGuards,
      zValidator("json", userInput),
      async (context) => {
        const principal = (context as unknown as PlatformContext).get(
          "sessionPrincipal",
        ) as SessionPrincipal;
        const result = await options.auth.platform.createUser(principal, context.req.valid("json"));
        return context.json(result, 201);
      },
    )
    .post(
      "/api/platform/organizations",
      ...platformGuards,
      zValidator("json", organizationInput),
      async (context) => {
        const principal = (context as unknown as PlatformContext).get(
          "sessionPrincipal",
        ) as SessionPrincipal;
        const result = await options.auth.platform.createOrganization(
          principal,
          context.req.valid("json"),
        );
        return context.json(result, 201);
      },
    )
    .patch(
      "/api/platform/organizations/:id/status",
      ...platformGuards,
      zValidator("param", z.object({ id: z.string().min(1) })),
      zValidator("json", statusInput),
      async (context) => {
        const principal = (context as unknown as PlatformContext).get(
          "sessionPrincipal",
        ) as SessionPrincipal;
        await options.auth.platform.setOrganizationStatus(principal, {
          organizationId: context.req.valid("param").id,
          status: context.req.valid("json").status,
        });
        return context.body(null, 204);
      },
    )
    .post(
      "/api/platform/users/:id/password-reset",
      ...platformGuards,
      zValidator("param", z.object({ id: z.string().min(1) })),
      async (context) => {
        const principal = (context as unknown as PlatformContext).get(
          "sessionPrincipal",
        ) as SessionPrincipal;
        await options.auth.platform.requestPasswordReset(principal, {
          userId: context.req.valid("param").id,
        });
        return context.body(null, 204);
      },
    );
  const withStatus = withPlatform.get("/api/auth/ok", (context) => context.json({ ok: true }));
  return withStatus.on(["GET", "POST"], "/api/auth/*", (context) => {
    // Admin mutations are exposed only through PlatformAuthService, never as public HTTP routes.
    if (context.req.path.includes("/admin/")) return context.json({ error: "Not found" }, 404);
    return options.auth.auth.handler(context.req.raw);
  });
}
