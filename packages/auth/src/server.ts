import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { adminAc } from "better-auth/plugins/admin/access";
import { organization } from "better-auth/plugins/organization";
import type { Database } from "@full-stack-example/database";
import { member, organization as organizationTable } from "@full-stack-example/database";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type {
  AuthGuardPort,
  AuthHandler,
  Mailer,
  PermissionPolicy,
  PlatformAuthService,
  SecurityEventSink,
} from "./contracts.js";
import { createPermissionPolicy } from "./permissions.js";

export interface AuthModuleOptions {
  readonly database: Database;
  readonly baseURL: string;
  readonly secret: string;
  readonly trustedOrigins: readonly string[];
  readonly mailer?: Mailer;
  readonly securityEvents?: SecurityEventSink;
  readonly policy?: PermissionPolicy;
}

export interface AuthModule {
  readonly auth: AuthHandler;
  readonly guards: AuthGuardPort;
  readonly platform: PlatformAuthService;
}

export function createAuthModule(options: AuthModuleOptions): AuthModule {
  const policy = options.policy ?? createPermissionPolicy();
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
        roles: { "platform-admin": adminAc },
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
            url: `${options.baseURL}/accept-invitation?id=${encodeURIComponent(data.id)}`,
          });
        },
      }),
    ],
    rateLimit: { enabled: true },
    advanced: { useSecureCookies: options.baseURL.startsWith("https://") },
  });

  const sessionFor = async (request: Request) => (await (auth.api as any).getSession({ headers: request.headers })) as any;
  return {
    auth,
    guards: {
      requireSession: async (context, next) => { const value = await sessionFor(context.req.raw); if (!value?.user || !value.session) return context.json({ error: "Unauthorized" }, 401); await next(); },
      requireTenant: async (context, next) => {
        const value = await sessionFor(context.req.raw);
        const tenantId = value?.session?.activeOrganizationId;
        if (!value?.user || !value.session) return context.json({ error: "Unauthorized" }, 401);
        if (!tenantId) return context.json({ error: "Active organization required" }, 400);
        const [membership, tenant] = await Promise.all([
          options.database.query.member.findFirst({ where: and(eq(member.organizationId, tenantId), eq(member.userId, value.user.id)) }),
          options.database.query.organization.findFirst({ where: eq(organizationTable.id, tenantId) }),
        ]);
        if (!membership) return context.json({ error: "Forbidden" }, 403);
        if (!tenant || tenant.status !== "active") return context.json({ error: "Organization disabled" }, 403);
        context.set("tenantId", tenantId);
        context.set("memberRole", membership.role);
        await next();
      },
      requirePlatformAdmin: async (context, next) => { const value = await sessionFor(context.req.raw); if (value?.user?.role !== "platform-admin") return context.json({ error: "Forbidden" }, 403); await next(); },
      requireFreshSession: async (context, next) => { const value = await sessionFor(context.req.raw); if (!value?.session?.fresh) return context.json({ error: "Fresh session required" }, 403); await next(); },
      requirePermission: (requirement) => async (context, next) => {
        const value = await sessionFor(context.req.raw);
        const role = value?.user?.role === "platform-admin" ? "owner" : (context.get("memberRole") as "owner" | "admin" | "member" | undefined) ?? "member";
        const allowed = policy.roles[role]?.[requirement.resource]?.includes(requirement.action) ?? false;
        if (!allowed) return context.json({ error: "Forbidden" }, 403);
        await next();
      },
    },
    platform: {
      async createUser(input) {
        const password = randomBytes(24).toString("base64url");
        const result = await (auth.api as any).createUser({ body: { email: input.email, name: input.name, password, role: "user" } });
        await options.securityEvents?.emit({ event: "auth.user.created", metadata: { email: input.email } });
        return { id: result.user.id };
      },
      async createOrganization(input) {
        const result = await (auth.api as any).createOrganization({ body: { name: input.name, slug: input.slug, userId: input.ownerUserId } });
        await options.securityEvents?.emit({ event: "auth.organization.created", organizationId: result.id, actorUserId: input.ownerUserId });
        return { id: result.id };
      },
      async setOrganizationStatus(input) {
        await options.database.update(organizationTable).set({ status: input.status }).where(eq(organizationTable.id, input.organizationId));
        await options.securityEvents?.emit({ event: "auth.organization.status_changed", organizationId: input.organizationId, metadata: { status: input.status } });
      },
      async requestPasswordReset(input) {
        await (auth.api as any).requestPasswordReset({ body: { email: input.email, redirectTo: `${options.baseURL}/reset-password` } });
        await options.securityEvents?.emit({ event: "auth.password_reset.requested", metadata: { email: input.email } });
      },
    },
  };
}

export { createPermissionPolicy } from "./permissions.js";
