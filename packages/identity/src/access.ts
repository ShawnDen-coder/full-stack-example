import {
	type Access,
	type PageKey,
	pageKeys,
	workspaceToolKeys,
} from "@full-stack-example/access";
import type { Database } from "@full-stack-example/db";
import { member, workspaceTool } from "@full-stack-example/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import type { Auth } from "./auth";
import { createWorkspaceService } from "./workspaces";

export function createAccessService(auth: Auth, db: Database) {
	const workspaces = createWorkspaceService(auth, db);
	async function canReadPage(
		headers: Headers,
		page: PageKey,
		workspaceId: string,
	): Promise<boolean> {
		if (page === "queues") return false;
		const session = await auth.api.getSession({ headers });
		if (!session) throw new ORPCError("UNAUTHORIZED");
		const [membership] = await db
			.select({ id: member.id })
			.from(member)
			.where(
				and(
					eq(member.organizationId, workspaceId),
					eq(member.userId, session.user.id),
				),
			);
		if (!membership) return false;
		// Unknown/missing tool configuration denies access; demo pages remain role controlled.
		if (workspaceToolKeys.some((key) => key === page)) {
			const [tool] = await db
				.select()
				.from(workspaceTool)
				.where(
					and(
						eq(workspaceTool.workspaceId, workspaceId),
						eq(workspaceTool.toolKey, page),
					),
				);
			if (!tool?.enabled) return false;
		}
		const permission = await auth.api.hasPermission({
			headers,
			body: { organizationId: workspaceId, permissions: { [page]: ["read"] } },
		});
		return permission.success;
	}
	return {
		workspaces,
		canReadPage,
		async getAccess(headers: Headers, workspaceId?: string): Promise<Access> {
			const session = await auth.api.getSession({ headers });
			if (!session) throw new ORPCError("UNAUTHORIZED");
			const platformRole =
				session.user.role === "superadmin" ? "superadmin" : "user";
			const selected = workspaceId ?? (await workspaces.mine(headers))[0]?.id;
			const [current] = selected
				? await db
						.select()
						.from(member)
						.where(
							and(
								eq(member.organizationId, selected),
								eq(member.userId, session.user.id),
							),
						)
				: [];
			if (!current) return { role: "user", platformRole, pages: [] };
			const pages: PageKey[] = [];
			for (const page of pageKeys)
				if (await canReadPage(headers, page, current.organizationId))
					pages.push(page);
			const memberRoles = current.role.split(",");
			return {
				role: memberRoles.some((role) => role === "owner" || role === "admin")
					? "admin"
					: "user",
				platformRole,
				workspaceRole: current.role,
				organizationId: current.organizationId,
				pages,
			};
		},
	};
}
export type AccessService = ReturnType<typeof createAccessService>;
