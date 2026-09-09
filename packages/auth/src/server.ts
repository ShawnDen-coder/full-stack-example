import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";
import type { Database } from "@full-stack-example/database";
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
  options.policy ?? createPermissionPolicy();
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
    },
    plugins: [
      admin({
        adminRoles: ["platform-admin"],
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

  return {
    auth,
    guards: {
      requireSession: async (_context, next) => next(),
      requireTenant: async (_context, next) => next(),
      requirePlatformAdmin: async (_context, next) => next(),
      requireFreshSession: async (_context, next) => next(),
      requirePermission: () => async (_context, next) => next(),
    },
    platform: {
      async createUser() {
        throw new Error("Platform user provisioning is not implemented yet");
      },
      async createOrganization() {
        throw new Error("Platform organization provisioning is not implemented yet");
      },
      async setOrganizationStatus() {
        throw new Error("Organization status management is not implemented yet");
      },
    },
  };
}

export { createPermissionPolicy } from "./permissions.js";
