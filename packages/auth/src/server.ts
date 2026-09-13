import type { Database } from "@full-stack-example/database";
import { organization as organizationTable, user as userTable } from "@full-stack-example/database";
import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { organization } from "better-auth/plugins/organization";
import { eq } from "drizzle-orm";
import type {
  AuthGuardPort,
  AuthHandler,
  PermissionPolicy,
  PlatformAuthService,
  SecurityEventSink,
} from "./contracts.js";
import { createAuthGuards } from "./guards.js";
import { normalizeAuthOpenApiDocument } from "./openapi.js";
import { createPermissionPolicy } from "./permissions.js";

export interface AuthModuleOptions {
  readonly database: Database;
  readonly baseURL: string;
  readonly secret: string;
  readonly trustedOrigins: readonly string[];
  readonly securityEvents?: SecurityEventSink;
  readonly policy?: PermissionPolicy;
  /** Maximum session age for sensitive platform actions; zero disables the check. */
  readonly freshAgeSeconds?: number;
  /** Enables Better Auth's schema endpoint for API documentation generation. */
  readonly openApiEnabled?: boolean;
}

export interface PlatformAdminBootstrap {
  readonly email: string;
  readonly name: string;
  readonly password: string;
}

export interface AuthModule {
  readonly auth: AuthHandler;
  readonly require: AuthGuardPort;
  readonly platform: PlatformAuthService;
  readonly ensurePlatformAdmin: (
    input: PlatformAdminBootstrap,
  ) => Promise<{ readonly id: string; readonly created: boolean }>;
  readonly getOpenApiDocument?: () => Promise<Record<string, unknown>>;
}

export function createAuthModule(options: AuthModuleOptions): AuthModule {
  const policy = options.policy ?? createPermissionPolicy();
  const freshAgeSeconds = options.freshAgeSeconds ?? 86_400;
  if (!Number.isSafeInteger(freshAgeSeconds) || freshAgeSeconds < 0)
    throw new Error("freshAgeSeconds must be a non-negative integer");
  const auth = betterAuth({
    database: drizzleAdapter(options.database, { provider: "pg" }),
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: [...options.trustedOrigins],
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
    },
    disabledPaths: ["/request-password-reset", "/reset-password/:token"],
    plugins: [
      admin({
        adminRoles: ["platform-admin"],
        roles: { "platform-admin": adminAc, user: userAc },
      }),
      organization({
        allowUserToCreateOrganization: true,
        creatorRole: "owner",
        disableOrganizationDeletion: true,
        requireEmailVerificationOnInvitation: true,
        cancelPendingInvitationsOnReInvite: true,
        organizationHooks: {
          async beforeCreateInvitation() {
            throw APIError.fromStatus("FORBIDDEN", {
              code: "INVITATIONS_DISABLED",
              message: "Organization invitations are disabled until email delivery is configured.",
            });
          },
        },
      }),
      ...(options.openApiEnabled ? [openAPI({ disableDefaultReference: true })] : []),
    ],
    rateLimit: { enabled: true, storage: "database" },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, freshAge: freshAgeSeconds },
    databaseHooks: {
      session: {
        create: {
          after: async ({ data }) => {
            const session = data as { readonly userId: string; readonly id: string };
            await options.securityEvents?.emit({
              event: "auth.session.created",
              actorUserId: session.userId,
              metadata: { sessionId: session.id },
            });
          },
        },
        delete: {
          after: async ({ data }) => {
            const session = data as { readonly userId: string; readonly id: string };
            await options.securityEvents?.emit({
              event: "auth.session.revoked",
              actorUserId: session.userId,
              metadata: { sessionId: session.id },
            });
          },
        },
      },
    },
    advanced: { useSecureCookies: options.baseURL.startsWith("https://"), disableCSRFCheck: false },
  });

  type SessionValue = {
    readonly user?: { readonly id: string; readonly role?: unknown };
    readonly session?: {
      readonly id: string;
      readonly activeOrganizationId?: string | null;
      readonly createdAt?: Date | string;
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
    generateOpenAPISchema?: () => Promise<Record<string, unknown>>;
  };
  const getOpenApiSchema = options.openApiEnabled ? authApi.generateOpenAPISchema : undefined;
  const require = createAuthGuards({
    database: options.database,
    freshAgeSeconds,
    policy,
    getSession: (context) => authApi.getSession({ headers: context.req.raw.headers }),
  });
  return {
    auth,
    require,
    platform: {
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
    },
    async ensurePlatformAdmin(input: PlatformAdminBootstrap) {
      const existing = await options.database.query.user.findFirst({
        where: eq(userTable.email, input.email),
      });
      if (existing) {
        if (existing.role !== "platform-admin")
          await options.database
            .update(userTable)
            .set({ role: "platform-admin" })
            .where(eq(userTable.id, existing.id));
        return { id: existing.id, created: false };
      }
      const result = await authApi.createUser({
        body: {
          email: input.email,
          name: input.name,
          password: input.password,
          role: "platform-admin",
        },
      });
      return { id: result.user.id, created: true };
    },
    ...(getOpenApiSchema
      ? {
          getOpenApiDocument: async () => normalizeAuthOpenApiDocument(await getOpenApiSchema()),
        }
      : {}),
  };
}

export { createPermissionPolicy } from "./permissions.js";
export { setupAuthApp } from "./route.js";
