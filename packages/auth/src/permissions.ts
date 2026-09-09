import type { OrganizationRole, PermissionPolicy } from "./contracts.js";

export function createPermissionPolicy(
  input: {
    readonly roles?: Partial<Record<OrganizationRole, Record<string, readonly string[]>>>;
  } = {},
): PermissionPolicy {
  return {
    roles: {
      owner: input.roles?.owner ?? {},
      admin: input.roles?.admin ?? {},
      member: input.roles?.member ?? {},
    },
  };
}
