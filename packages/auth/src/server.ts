import { randomBytes } from "node:crypto";
import type { Database } from "@full-stack-example/database";
import {
  member,
  organization as organizationTable,
  user as userTable,
} from "@full-stack-example/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { organization } from "better-auth/plugins/organization";
import { and, eq } from "drizzle-orm";
import type {
  AuthGuardPort,
  AuthHandler,
  Mailer,
  PermissionPolicy,
  PlatformAuthService,
  SecurityEventSink,
} from "./contracts.js";
import { createSessionPrincipal, createTenantPrincipal } from "./middleware.js";
import { createPermissionPolicy } from "./permissions.js";

export interface AuthModuleOptions {
  readonly database: Database;
  readonly baseURL: string;
  readonly webBaseURL?: string;
  readonly secret: string;
  readonly trustedOrigins: readonly string[];
  readonly mailer?: Mailer;
  readonly securityEvents?: SecurityEventSink;
  readonly policy?: PermissionPolicy;
}

export interface AuthModule {
  readonly auth: AuthHandler;
  readonly require: AuthGuardPort;
  readonly platform: PlatformAuthService;
}

export function createAuthModule(options: AuthModuleOptions): AuthModule {
  const policy = options.policy ?? createPermissionPolicy();
  const webBaseURL = options.webBaseURL ?? options.baseURL;
  const auth = betterAuth({
    database: drizzleAdapter(options.database, { provider: "pg" }),
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: [...options.trustedOrigins],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword(data) {
        if (!options.mailer) return;
        await options.mailer.sendPasswordReset({ email: data.user.email, url: data.url });
      },
    },
    plugins: [
      admin({
        adminRoles: ["platform-admin"],
        roles: { "platform-admin": adminAc, user: userAc },
      }),
      organization({
        allowUserToCreateOrganization: false,
        creatorRole: "owner",
        disableOrganizationDeletion: true,
        requireEmailVerificationOnInvitation: true,
        cancelPendingInvitationsOnReInvite: true,
        async sendInvitationEmail(data) {
          if (!options.mailer) return;
          await options.mailer.sendOrganizationInvitation({
            email: data.email,
            organizationName: data.organization.name,
            url: `${webBaseURL}/accept-invitation?id=${encodeURIComponent(data.id)}`,
          });
        },
      }),
    ],
    rateLimit: { enabled: true },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    advanced: { useSecureCookies: options.baseURL.startsWith("https://"), disableCSRFCheck: false },
  });

  type SessionValue = {
    readonly user?: { readonly id: string; readonly role?: unknown };
    readonly session?: {
      readonly id: string;
      readonly activeOrganizationId?: string | null;
      readonly fresh?: boolean;
    };
  } | null;
  const authApi = auth.api as unknown as {
    getSession(input: { readonly headers: Headers }): Promise<SessionValue>;
    createUser(input: {
      readonly body: Record<string, unknown>;
    }): Promise<{ readonly user: { readonly id: string } }>;
    createOrganization(input: {
      readonly body: Record<string, unknown>;
    }): Promise<{ readonly id: string }>;
    requestPasswordReset(input: { readonly body: Record<string, unknown> }): Promise<void>;
  };
  const sessionFor = async (context: Parameters<AuthGuardPort["requireSession"]>[0]) => {
    const cached = context.get("authSession");
    if (cached !== undefined) return cached as SessionValue;
    const value = await authApi.getSession({ headers: context.req.raw.headers });
    context.set("authSession", value);
    return value;
  };
  const sessionPrincipalFor = async (context: Parameters<AuthGuardPort["requireSession"]>[0]) => {
    const value = await sessionFor(context);
    if (!value?.user || !value.session) return undefined;
    const existing = context.get("sessionPrincipal");
    if (existing) return existing as ReturnType<typeof createSessionPrincipal>;
    const platformRole = value.user.role === "platform-admin" ? "platform-admin" : "user";
    const principal = createSessionPrincipal({
      userId: value.user.id,
      sessionId: value.session.id,
      platformRole,
    });
    context.set("sessionPrincipal", principal);
    return principal;
  };
  const tenantPrincipalFor = async (context: Parameters<AuthGuardPort["requireSession"]>[0]) => {
    const sessionPrincipal = await sessionPrincipalFor(context);
    const value = await sessionFor(context);
    if (!sessionPrincipal || !value?.session) return undefined;
    const tenantId = value.session.activeOrganizationId;
    if (!tenantId) return null;
    const existing = context.get("tenantPrincipal");
    if (existing) return existing as ReturnType<typeof createTenantPrincipal>;
    const [membership, tenant] = await Promise.all([
      options.database.query.member.findFirst({
        where: and(eq(member.organizationId, tenantId), eq(member.userId, sessionPrincipal.userId)),
      }),
      options.database.query.organization.findFirst({ where: eq(organizationTable.id, tenantId) }),
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
    requirement: { resource: string; action: string },
  ) => policy.roles[role]?.[requirement.resource]?.includes(requirement.action) ?? false;
  return {
    auth,
    require: {
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
        if (value?.user?.role !== "platform-admin")
          return context.json({ error: "Forbidden" }, 403);
        await next();
      },
      requireFreshSession: async (context, next) => {
        const value = await sessionFor(context);
        if (!value?.user || !value.session) return context.json({ error: "Unauthorized" }, 401);
        if (!value.session.fresh) return context.json({ error: "Fresh session required" }, 403);
        await next();
      },
      requirePermission: (requirement) => async (context, next) => {
        const principal = context.get("tenantPrincipal") as
          | ReturnType<typeof createTenantPrincipal>
          | undefined;
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
    },
    platform: {
      async createUser(actor, input) {
        const password = randomBytes(24).toString("base64url");
        const result = await authApi.createUser({
          body: { email: input.email, name: input.name, password, role: "user" },
        });
        await authApi.requestPasswordReset({
          body: { email: input.email, redirectTo: `${webBaseURL}/reset-password` },
        });
        await options.securityEvents?.emit({
          event: "auth.user.created",
          actorUserId: actor.userId,
          metadata: { email: input.email },
        });
        return { id: result.user.id };
      },
      async createOrganization(actor, input) {
        const result = await authApi.createOrganization({
          body: { name: input.name, slug: input.slug, userId: input.ownerUserId },
        });
        await options.securityEvents?.emit({
          event: "auth.organization.created",
          organizationId: result.id,
          actorUserId: actor.userId,
          metadata: { ownerUserId: input.ownerUserId },
        });
        return { id: result.id };
      },
      async setOrganizationStatus(actor, input) {
        await options.database
          .update(organizationTable)
          .set({ status: input.status })
          .where(eq(organizationTable.id, input.organizationId));
        await options.securityEvents?.emit({
          event: "auth.organization.status_changed",
          actorUserId: actor.userId,
          organizationId: input.organizationId,
          metadata: { status: input.status },
        });
      },
      async requestPasswordReset(actor, input) {
        const target = await options.database.query.user.findFirst({
          where: eq(userTable.id, input.userId),
        });
        if (!target) return;
        await authApi.requestPasswordReset({
          body: { email: target.email, redirectTo: `${webBaseURL}/reset-password` },
        });
        await options.securityEvents?.emit({
          event: "auth.password_reset.requested",
          actorUserId: actor.userId,
          metadata: { userId: input.userId },
        });
      },
    },
  };
}

export { createPermissionPolicy } from "./permissions.js";
export { setupAuthApp } from "./setup-app.js";
