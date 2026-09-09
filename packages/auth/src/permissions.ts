import type { OrganizationRole, PermissionPolicy } from "./contracts.js";

export function createPermissionPolicy(
  input: {
    readonly statements?: Record<string, readonly string[]>;
    readonly roles?: Partial<Record<OrganizationRole, Record<string, readonly string[]>>>;
  } = {},
): PermissionPolicy {
  return {
    statements: input.statements ?? {},
    roles: {
      owner: input.roles?.owner ?? {},
      admin: input.roles?.admin ?? {},
      member: input.roles?.member ?? {},
    },
  };
}
