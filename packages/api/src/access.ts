import { type Access, pageKeys, workspaceId } from "@full-stack-example/access";
import type { Auth } from "./auth";

// A transport adapter only: Better Auth owns membership, storage and authorization.
export function createAccessService(auth: Auth) {
	return {
		async getAccess(headers: Headers): Promise<Access> {
			const current = await auth.api.getActiveMember({
				headers,
				query: { organizationId: workspaceId },
			});
			const permissions = await Promise.all(
				pageKeys.map(async (page) => ({
					page,
					allowed: (
						await auth.api.hasPermission({
							headers,
							body: {
								organizationId: workspaceId,
								permissions: { [page]: ["read"] },
							},
						})
					).success,
				})),
			);
			const memberRoles = current.role.split(",");
			const role = memberRoles.includes("owner")
				? "superadmin"
				: memberRoles.includes("admin")
					? "admin"
					: "user";
			return {
				role,
				organizationId: workspaceId,
				pages: permissions
					.filter((item) => item.allowed)
					.map((item) => item.page),
			};
		},
	};
}
export type AccessService = ReturnType<typeof createAccessService>;
