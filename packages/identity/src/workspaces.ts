import { randomUUID } from "node:crypto";
import {
	defaultMemberRole,
	type WorkspaceToolKey,
} from "@full-stack-example/access";
import type { Database } from "@full-stack-example/db";
import {
	member,
	organization,
	organizationRole,
	user,
	workspaceTool,
} from "@full-stack-example/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Auth } from "./auth";
import { normalizeWorkspaceLogo } from "./workspace-logo";

export function createWorkspaceService(auth: Auth, db: Database) {
	async function actor(headers: Headers, platform = false) {
		const session = await auth.api.getSession({ headers });
		if (!session) throw new ORPCError("UNAUTHORIZED");
		if (platform && session.user.role !== "superadmin")
			throw new ORPCError("FORBIDDEN");
		return session.user;
	}
	return {
		async mine(headers: Headers) {
			const current = await actor(headers);
			return db
				.select({
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
					hasLogo: sql<boolean>`${organization.logo} IS NOT NULL`,
				})
				.from(organization)
				.innerJoin(member, eq(member.organizationId, organization.id))
				.where(eq(member.userId, current.id))
				.orderBy(asc(organization.name), asc(organization.id));
		},
		async list(headers: Headers, offset: number) {
			await actor(headers, true);
			const rows = await db
				.select({
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
					hasLogo: sql<boolean>`${organization.logo} IS NOT NULL`,
				})
				.from(organization)
				.orderBy(asc(organization.name), asc(organization.id))
				.offset(offset)
				.limit(26);
			const items = await Promise.all(
				rows.slice(0, 25).map(async (row) => ({
					...row,
					tools: await db
						.select({
							key: workspaceTool.toolKey,
							enabled: workspaceTool.enabled,
						})
						.from(workspaceTool)
						.where(eq(workspaceTool.workspaceId, row.id)),
				})),
			);
			return { items, hasMore: rows.length > 25 };
		},
		async create(
			headers: Headers,
			input: {
				name: string;
				slug: string;
				ownerEmail: string;
				tools: WorkspaceToolKey[];
				logo?: string | null;
			},
		) {
			await actor(headers, true);
			const logo = await normalizeWorkspaceLogo(input.logo ?? null);
			try {
				return await db.transaction(async (tx) => {
					const [owner] = await tx
						.select()
						.from(user)
						.where(eq(user.email, input.ownerEmail.toLowerCase()))
						.for("update");
					if (!owner || owner.banned)
						throw new ORPCError("BAD_REQUEST", {
							message: "An active owner account with this email is required.",
						});
					const id = randomUUID();
					await tx.insert(organization).values({
						id,
						name: input.name,
						slug: input.slug,
						logo,
						createdAt: new Date(),
					});
					await tx.insert(member).values({
						id: randomUUID(),
						organizationId: id,
						userId: owner.id,
						role: "owner",
						createdAt: new Date(),
					});
					await tx.insert(organizationRole).values({
						id: randomUUID(),
						organizationId: id,
						role: defaultMemberRole,
						permission: JSON.stringify({ todos: ["read"] }),
					});
					await tx.insert(workspaceTool).values({
						workspaceId: id,
						toolKey: "todos",
						enabled: input.tools.includes("todos"),
					});
					return { id, name: input.name, slug: input.slug };
				});
			} catch (error) {
				const cause =
					error instanceof Error && "cause" in error ? error.cause : error;
				if (
					cause &&
					typeof cause === "object" &&
					"code" in cause &&
					cause.code === "23505"
				)
					throw new ORPCError("CONFLICT", {
						message: "This workspace slug is already in use.",
					});
				throw error;
			}
		},
		async logo(headers: Headers, workspaceId: string) {
			const current = await actor(headers);
			if (current.role !== "superadmin") {
				const [membership] = await db
					.select({ id: member.id })
					.from(member)
					.where(
						and(
							eq(member.userId, current.id),
							eq(member.organizationId, workspaceId),
						),
					);
				if (!membership) throw new ORPCError("FORBIDDEN");
			}
			const [space] = await db
				.select({ logo: organization.logo })
				.from(organization)
				.where(eq(organization.id, workspaceId));
			if (!space) throw new ORPCError("NOT_FOUND");
			return space;
		},
		async updateBasics(
			headers: Headers,
			input: { workspaceId: string; name: string; logo: string | null },
		) {
			const current = await actor(headers);
			if (current.role !== "superadmin") {
				const [membership] = await db
					.select({ role: member.role })
					.from(member)
					.where(
						and(
							eq(member.userId, current.id),
							eq(member.organizationId, input.workspaceId),
						),
					);
				if (
					!membership?.role
						.split(",")
						.some((role) => role === "owner" || role === "admin")
				)
					throw new ORPCError("FORBIDDEN");
			}
			return db.transaction(async (tx) => {
				if (current.role !== "superadmin") {
					const [membership] = await tx
						.select({ role: member.role })
						.from(member)
						.where(
							and(
								eq(member.userId, current.id),
								eq(member.organizationId, input.workspaceId),
							),
						)
						.for("update");
					if (
						!membership?.role
							.split(",")
							.some((role) => role === "owner" || role === "admin")
					)
						throw new ORPCError("FORBIDDEN");
				}
				const [space] = await tx
					.select({ id: organization.id, logo: organization.logo })
					.from(organization)
					.where(eq(organization.id, input.workspaceId))
					.for("update");
				if (!space) throw new ORPCError("NOT_FOUND");
				const logo =
					input.logo === space.logo
						? space.logo
						: await normalizeWorkspaceLogo(input.logo);
				await tx
					.update(organization)
					.set({ name: input.name, logo })
					.where(eq(organization.id, input.workspaceId));
				return { id: space.id };
			});
		},
		async setTool(
			headers: Headers,
			input: { workspaceId: string; tool: WorkspaceToolKey; enabled: boolean },
		) {
			await actor(headers, true);
			return db.transaction(async (tx) => {
				const [space] = await tx
					.select({ id: organization.id })
					.from(organization)
					.where(eq(organization.id, input.workspaceId))
					.for("update");
				if (!space) throw new ORPCError("NOT_FOUND");
				await tx
					.insert(workspaceTool)
					.values({
						workspaceId: input.workspaceId,
						toolKey: input.tool,
						enabled: input.enabled,
					})
					.onConflictDoUpdate({
						target: [workspaceTool.workspaceId, workspaceTool.toolKey],
						set: { enabled: input.enabled },
					});
			});
		},
		async addMember(
			headers: Headers,
			input: { workspaceId: string; email: string },
		) {
			const current = await actor(headers);
			return db.transaction(async (tx) => {
				const [manager] = await tx
					.select()
					.from(member)
					.where(
						and(
							eq(member.organizationId, input.workspaceId),
							eq(member.userId, current.id),
						),
					)
					.for("update");
				if (
					!manager?.role
						.split(",")
						.some((role) => role === "owner" || role === "admin")
				)
					throw new ORPCError("FORBIDDEN");
				const [target] = await tx
					.select()
					.from(user)
					.where(eq(user.email, input.email.toLowerCase()))
					.for("update");
				if (!target || target.banned)
					throw new ORPCError("BAD_REQUEST", {
						message: "An active account with this email is required.",
					});
				await tx
					.insert(member)
					.values({
						id: randomUUID(),
						organizationId: input.workspaceId,
						userId: target.id,
						role: `member,${defaultMemberRole}`,
						createdAt: new Date(),
					})
					.onConflictDoNothing({
						target: [member.organizationId, member.userId],
					});
			});
		},
	};
}
