import type {
  OrganizationRole,
  PlatformRole,
  SessionPrincipal,
  TenantPrincipal,
} from "./contracts.js";

export function createSessionPrincipal(input: {
  userId: string;
  sessionId: string;
  platformRole?: PlatformRole;
}): SessionPrincipal {
  return {
    userId: input.userId,
    sessionId: input.sessionId,
    platformRole: input.platformRole ?? "user",
  };
}

export function createTenantPrincipal(input: {
  session: SessionPrincipal;
  tenantId: string;
  memberId: string;
  organizationRole: OrganizationRole;
}): TenantPrincipal {
  return {
    ...input.session,
    tenantId: input.tenantId,
    memberId: input.memberId,
    organizationRole: input.organizationRole,
  };
}
