import type { Database } from "@full-stack-example/database";
import { member, organization } from "@full-stack-example/database";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import type {
  AuthGuardPort,
  AuthVariables,
  PermissionPolicy,
  PlatformRole,
  TenantPrincipal,
} from "./contracts.js";
import { createSessionPrincipal, createTenantPrincipal } from "./middleware.js";

type SessionValue = {
  readonly user?: { readonly id: string; readonly role?: unknown };
  readonly session?: {
    readonly id: string;
    readonly activeOrganizationId?: string | null;
    readonly createdAt?: Date | string;
  };
} | null;
type AuthContext = Context<{ Variables: AuthVariables }>;

export function createAuthGuards(options: {
  readonly database: Database;
  readonly freshAgeSeconds: number;
  readonly policy: PermissionPolicy;
  readonly getSession: (context: AuthContext) => Promise<SessionValue>;
}): AuthGuardPort {
  const sessionFor = async (context: AuthContext): Promise<SessionValue> => {
    const cached = context.get("authSession");
    if (cached !== undefined) return cached as SessionValue;
    const value = await options.getSession(context);
    context.set("authSession", value);
    return value;
  };

  const sessionPrincipalFor = async (context: AuthContext) => {
    const value = await sessionFor(context);
    if (!value?.user || !value.session) return undefined;
    const existing = context.get("sessionPrincipal");
    if (existing) return existing;
    if (value.user.role !== "platform-admin" && value.user.role !== "user") return undefined;
    const principal = createSessionPrincipal({
      userId: value.user.id,
      sessionId: value.session.id,
      platformRole: value.user.role as PlatformRole,
    });
    context.set("sessionPrincipal", principal);
    return principal;
  };

  const tenantPrincipalFor = async (
    context: AuthContext,
  ): Promise<TenantPrincipal | null | undefined> => {
    const sessionPrincipal = await sessionPrincipalFor(context);
    const value = await sessionFor(context);
    if (!sessionPrincipal || !value?.session) return undefined;
    const tenantId = value.session.activeOrganizationId;
    if (!tenantId) return null;
    const existing = context.get("tenantPrincipal");
    if (existing) return existing;
    const [membership, tenant] = await Promise.all([
      options.database.query.member.findFirst({
        where: and(eq(member.organizationId, tenantId), eq(member.userId, sessionPrincipal.userId)),
      }),
      options.database.query.organization.findFirst({ where: eq(organization.id, tenantId) }),
    ]);
    if (!membership || !tenant || tenant.status !== "active") return null;
    if (membership.role !== "owner" && membership.role !== "admin" && membership.role !== "member")
      return null;
    const principal = createTenantPrincipal({
      session: sessionPrincipal,
      tenantId,
      memberId: membership.id,
      organizationRole: membership.role,
    });
    context.set("tenantPrincipal", principal);
    return principal;
  };

  const hasPermission = (
    role: "owner" | "admin" | "member",
    requirement: { readonly resource: string; readonly action: string },
  ) => options.policy.roles[role]?.[requirement.resource]?.includes(requirement.action) ?? false;

  return {
    requireSession: async (context, next) => {
      if (!(await sessionPrincipalFor(context)))
        return context.json({ error: "Unauthorized" }, 401);
      await next();
    },
    requireTenant: async (context, next) => {
      const value = await sessionFor(context);
      if (!(await sessionPrincipalFor(context)))
        return context.json({ error: "Unauthorized" }, 401);
      if (!value?.session?.activeOrganizationId)
        return context.json({ error: "Active organization required" }, 400);
      const principal = await tenantPrincipalFor(context);
      if (!principal) return context.json({ error: "Forbidden" }, 403);
      await next();
    },
    requirePlatformAdmin: async (context, next) => {
      const value = await sessionFor(context);
      if (!value?.user || !value.session) return context.json({ error: "Unauthorized" }, 401);
      if (value.user.role !== "platform-admin") return context.json({ error: "Forbidden" }, 403);
      await next();
    },
    requireFreshSession: async (context, next) => {
      const value = await sessionFor(context);
      if (!value?.user || !value.session) return context.json({ error: "Unauthorized" }, 401);
      if (options.freshAgeSeconds !== 0) {
        const createdAt = new Date(value.session.createdAt ?? Number.NaN).getTime();
        if (
          !Number.isFinite(createdAt) ||
          Date.now() - createdAt >= options.freshAgeSeconds * 1_000
        )
          return context.json({ error: "Fresh session required" }, 403);
      }
      await next();
    },
    requirePermission: (requirement) => async (context, next) => {
      const principal = context.get("tenantPrincipal");
      if (!principal || !hasPermission(principal.organizationRole, requirement))
        return context.json({ error: "Forbidden" }, 403);
      await next();
    },
    requireTenantPermission: (requirement) => async (context, next) => {
      const value = await sessionFor(context);
      if (!(await sessionPrincipalFor(context)))
        return context.json({ error: "Unauthorized" }, 401);
      if (!value?.session?.activeOrganizationId)
        return context.json({ error: "Active organization required" }, 400);
      const principal = await tenantPrincipalFor(context);
      if (!principal || !hasPermission(principal.organizationRole, requirement))
        return context.json({ error: "Forbidden" }, 403);
      await next();
    },
  };
}
