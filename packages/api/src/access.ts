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
			const pages: Access["pages"] = [];
			// Each native check resolves the session and membership from the database.
			// Reuse connections instead of expanding a cold pool for a single request.
			for (const page of pageKeys) {
				const permission = await auth.api.hasPermission({
					headers,
					body: {
						organizationId: workspaceId,
						permissions: { [page]: ["read"] },
					},
				});
				if (permission.success) pages.push(page);
			}
			const memberRoles = current.role.split(",");
			const role = memberRoles.includes("owner")
				? "superadmin"
				: memberRoles.includes("admin")
					? "admin"
					: "user";
			return {
				role,
				organizationId: workspaceId,
				pages,
			};
		},
	};
}
export type AccessService = ReturnType<typeof createAccessService>;
