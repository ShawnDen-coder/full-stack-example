import type { Context } from "hono";
import { createFactory } from "hono/factory";
import { describeRoute, validator } from "hono-openapi";
import type { SessionPrincipal } from "./contracts.js";
import {
  createPlatformOrganizationDescription,
  createPlatformUserDescription,
  organizationIdParam,
  organizationInput,
  requestPasswordResetDescription,
  setOrganizationStatusDescription,
  statusInput,
  userInput,
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

export function createPlatformUserHandlers(options: SetupAuthAppOptions) {
  const guards = platformGuards(options);
  return authFactory.createHandlers(
    describeRoute(createPlatformUserDescription),
    ...guards,
    validator("json", userInput),
    async (context) => {
      const result = await options.auth.platform.createUser(
        principalFor(context),
        context.req.valid("json"),
      );
      return context.json(result, 201);
    },
  );
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

export function requestPasswordResetHandlers(options: SetupAuthAppOptions) {
  const guards = platformGuards(options);
  return authFactory.createHandlers(
    describeRoute(requestPasswordResetDescription),
    ...guards,
    validator("param", organizationIdParam),
    async (context) => {
      await options.auth.platform.requestPasswordReset(principalFor(context), {
        userId: context.req.valid("param").id,
      });
      return context.body(null, 204);
    },
  );
}

export function authHandler(options: SetupAuthAppOptions) {
  return authFactory.createHandlers(async (context) => {
    if (context.req.path === "/api/auth/ok" || context.req.path.includes("/admin/"))
      return context.json({ error: "Not found" }, 404);
    return options.auth.auth.handler(context.req.raw);
  });
}
