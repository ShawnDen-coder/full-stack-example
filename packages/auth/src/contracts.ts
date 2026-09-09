import type { MiddlewareHandler } from "hono";

export type PlatformRole = "platform-admin" | "user";
export type OrganizationRole = "owner" | "admin" | "member";

export interface SessionPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly platformRoles: readonly PlatformRole[];
}

export interface TenantPrincipal extends SessionPrincipal {
  readonly tenantId: string;
  readonly memberId: string;
  readonly organizationRoles: readonly OrganizationRole[];
  readonly requestId: string;
}

export interface PermissionRequirement {
  readonly resource: string;
  readonly action: string;
}

export interface SecurityEvent {
  readonly event: string;
  readonly actorUserId?: string;
  readonly organizationId?: string;
  readonly requestId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SecurityEventSink {
  emit(event: SecurityEvent): Promise<void>;
}

export interface Mailer {
  sendPasswordReset(input: { readonly email: string; readonly url: string }): Promise<void>;
  sendOrganizationInvitation(input: {
    readonly email: string;
    readonly organizationName: string;
    readonly url: string;
  }): Promise<void>;
}

export type AuthMiddleware = MiddlewareHandler;

export interface PermissionPolicy {
  readonly statements: Record<string, readonly string[]>;
  readonly roles: Record<OrganizationRole, Record<string, readonly string[]>>;
}

export interface AuthGuardPort {
  readonly requireSession: AuthMiddleware;
  readonly requireTenant: AuthMiddleware;
  readonly requirePlatformAdmin: AuthMiddleware;
  readonly requireFreshSession: AuthMiddleware;
  requirePermission(requirement: PermissionRequirement): AuthMiddleware;
}

export interface AuthHandler {
  handler(request: Request): Promise<Response>;
}

export interface PlatformAuthService {
  createUser(input: { readonly email: string; readonly name: string }): Promise<{ readonly id: string }>;
  createOrganization(input: {
    readonly name: string;
    readonly slug: string;
    readonly ownerUserId: string;
  }): Promise<{ readonly id: string }>;
  setOrganizationStatus(input: {
    readonly organizationId: string;
    readonly status: "active" | "disabled";
  }): Promise<void>;
}
