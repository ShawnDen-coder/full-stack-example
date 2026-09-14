import type { Context } from "hono";
import { createFactory } from "hono/factory";
import { describeRoute, validator } from "hono-openapi";
import type { SessionPrincipal } from "./contracts.js";
import {
  createPlatformOrganizationDescription,
  organizationIdParam,
  organizationInput,
  setOrganizationStatusDescription,
  statusInput,
} from "./route.desc.js";
import type { AuthRouteEnv, SetupAuthAppOptions } from "./types.js";

const authFactory = createFactory<AuthRouteEnv>();

const platformGuards = (options: SetupAuthAppOptions) =>
  [
    options.auth.require.requireSession,
    options.auth.require.requirePlatformAdmin,
    options.auth.require.requireFreshSession,
  ] as const;

function principalFor(context: Context<AuthRouteEnv>): SessionPrincipal {
  const principal = context.var.sessionPrincipal;
  if (!principal) throw new Error("Session principal is required");
  return principal;
}

export function createPlatformOrganizationHandlers(options: SetupAuthAppOptions) {
  const guards = platformGuards(options);
  return authFactory.createHandlers(
    describeRoute(createPlatformOrganizationDescription),
    ...guards,
    validator("json", organizationInput),
    async (context) => {
      const result = await options.auth.platform.createOrganization(
        principalFor(context),
        context.req.valid("json"),
      );
      return context.json(result, 201);
    },
  );
}

export function setOrganizationStatusHandlers(options: SetupAuthAppOptions) {
  const guards = platformGuards(options);
  return authFactory.createHandlers(
    describeRoute(setOrganizationStatusDescription),
    ...guards,
    validator("param", organizationIdParam),
    validator("json", statusInput),
    async (context) => {
      await options.auth.platform.setOrganizationStatus(principalFor(context), {
        organizationId: context.req.valid("param").id,
        status: context.req.valid("json").status,
      });
      return context.body(null, 204);
    },
  );
}

export function authHandler(options: SetupAuthAppOptions) {
  return authFactory.createHandlers(async (context) => {
    const path = context.req.path.replace(/^\/api(?=\/auth(?:\/|$))/u, "");
    if (path === "/auth/ok" || path.includes("/admin/"))
      return context.json({ error: "Not found" }, 404);
    if (
      [
        "/auth/request-password-reset",
        "/auth/send-verification-email",
        "/auth/verify-email",
      ].includes(path) ||
      path.startsWith("/auth/reset-password/")
    )
      return context.json(
        { error: "Email delivery is not configured", code: "EMAIL_DISABLED" },
        410,
      );
    return options.auth.auth.handler(context.req.raw);
  });
}
