import type { AuthModule } from "@full-stack-example/auth/server";
import type { Context, MiddlewareHandler, Next } from "hono";

const readMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function requireSameOrigin(webOrigin: string): MiddlewareHandler {
  return async (context: Context, next: Next) => {
    if (readMethods.has(context.req.method)) return next();
    const origin = context.req.header("Origin");
    const requestOrigin = new URL(context.req.url).origin;
    if (!origin || (origin !== webOrigin && origin !== requestOrigin))
      return context.json({ error: "CSRF validation failed" }, 403);
    return next();
  };
}

export function createAppPolicies(options: {
  readonly auth: AuthModule;
  readonly webOrigin: string;
}) {
  const { auth } = options;
  const platformAdminRead = [
    auth.require.requireSession,
    auth.require.requirePlatformAdmin,
  ] as const;
  const platformAdminFresh = [...platformAdminRead, auth.require.requireFreshSession] as const;
  const sameOrigin = requireSameOrigin(options.webOrigin);
  const platformAdminMutation = [sameOrigin, ...platformAdminFresh] as const;
  const platformAdminBoard = [
    sameOrigin,
    ...platformAdminRead,
    async (context: Context, next: Next) => {
      if (readMethods.has(context.req.method)) return next();
      return auth.require.requireFreshSession(context, next);
    },
  ] as const;

  return {
    tenantPermission: (input: { readonly resource: string; readonly action: string }) =>
      auth.require.requireTenantPermission(input),
    resolveTenantId: (context: Context) =>
      (context.get("tenantPrincipal") as { readonly tenantId?: string } | undefined)?.tenantId,
    platformAdminRead,
    platformAdminFresh,
    platformAdminMutation,
    platformAdminBoard,
  } as const;
}

export type AppPolicies = ReturnType<typeof createAppPolicies>;
