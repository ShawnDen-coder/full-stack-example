import type { OrganizationRole, PlatformRole, SessionPrincipal, TenantPrincipal } from "./contracts.js";

export function createSessionPrincipal(input: {
  userId: string;
  sessionId: string;
  platformRoles?: readonly PlatformRole[];
}): SessionPrincipal {
  return { userId: input.userId, sessionId: input.sessionId, platformRoles: input.platformRoles ?? [] };
}

export function createTenantPrincipal(input: {
  session: SessionPrincipal;
  tenantId: string;
  memberId: string;
  organizationRoles: readonly OrganizationRole[];
  requestId: string;
}): TenantPrincipal {
  return { ...input.session, tenantId: input.tenantId, memberId: input.memberId, organizationRoles: input.organizationRoles, requestId: input.requestId };
}
