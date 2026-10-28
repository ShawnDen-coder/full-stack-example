import { randomUUID } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import {
	defaultMemberRole,
	pageKeys,
	workspaceId,
} from "@full-stack-example/access";
import {
	ac,
	adminAccess,
	authRoles,
	organizationRoles,
} from "@full-stack-example/access/auth";
import type { Database } from "@full-stack-example/db";
import * as schema from "@full-stack-example/db/schema/auth";
import { betterAuth } from "better-auth";
import {
	APIError,
	createAuthMiddleware,
	getSessionFromCtx,
} from "better-auth/api";
import { admin, organization } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";

export type AuthConfig = {
	db: Database;
	secret: string;
	baseURL: string;
	trustedOrigins: string[];
};

export function createAuth({
	db,
	secret,
	baseURL,
	trustedOrigins,
}: AuthConfig) {
	return betterAuth({
		database: drizzleAdapter(db, { provider: "pg", schema }),
		secret,
		baseURL,
		trustedOrigins,
		emailAndPassword: { enabled: true },
		plugins: [
			admin({
				ac: adminAccess,
				roles: authRoles,
				defaultRole: "user",
				adminRoles: ["superadmin"],
			}),
			organization({
				ac,
				roles: organizationRoles,
				allowUserToCreateOrganization: false,
				dynamicAccessControl: {
					enabled: true,
					maximumRolesPerOrganization: 100,
				},
				organizationHooks: {
					beforeUpdateMemberRole: async ({ newRole }) => {
						const assigned = newRole.split(",");
						if (!assigned.some((role) => role === "owner" || role === "admin"))
							return {
								data: { role: [...new Set(["member", ...assigned])].join(",") },
							};
					},
				},
			}),
		],
		databaseHooks: {
			user: {
				create: {
					after: async (user) => {
						await db.insert(schema.member).values({
							id: randomUUID(),
							userId: user.id,
							organizationId: workspaceId,
							role: `member,${defaultMemberRole}`,
							createdAt: new Date(),
						});
					},
				},
			},
			session: {
				create: {
					before: async (session) => ({
						data: { ...session, activeOrganizationId: workspaceId },
					}),
				},
			},
		},
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (
					[
						"/organization/delete",
						"/organization/leave",
						"/organization/remove-member",
					].includes(ctx.path)
				)
					throw new APIError("FORBIDDEN", {
						message:
							"The application workspace and memberships are managed through deployment provisioning",
					});
				// Organization member hooks receive the target user, not the actor.
				// Read the authenticated actor here, then let the native endpoint authorize and mutate.
				if (ctx.path === "/organization/update-member-role") {
					const session = await getSessionFromCtx(ctx);
					if (!session) throw new APIError("UNAUTHORIZED");
					const [actor] = await db
						.select()
						.from(schema.member)
						.where(
							and(
								eq(schema.member.userId, session.user.id),
								eq(schema.member.organizationId, workspaceId),
							),
						);
					const [target] = await db
						.select()
						.from(schema.member)
						.where(eq(schema.member.id, ctx.body.memberId));
					const assigned = (
						Array.isArray(ctx.body.role) ? ctx.body.role : [ctx.body.role]
					)
						.flatMap((role: string) => role.split(","))
						.map((role: string) => role.trim());
					if (
						target?.role.split(",").includes("owner") ||
						assigned.includes("owner")
					)
						throw new APIError("FORBIDDEN", {
							message:
								"Workspace owners are managed through deployment provisioning",
						});
					if (
						!actor?.role.split(",").includes("owner") &&
						(target?.role.split(",").includes("admin") ||
							assigned.includes("admin"))
					)
						throw new APIError("FORBIDDEN", {
							message: "Only owners can manage administrators",
						});
				}
				// Editable role templates can grant business pages, never administrative capabilities.
				if (
					["/organization/create-role", "/organization/update-role"].includes(
						ctx.path,
					)
				) {
					const permission = ctx.body?.permission ?? ctx.body?.data?.permission;
					if (
						permission &&
						Object.entries(permission).some(
							([resource, actions]) =>
								!pageKeys.some((key) => key === resource) ||
								!Array.isArray(actions) ||
								actions.some((action) => action !== "read"),
						)
					)
						throw new APIError("FORBIDDEN", {
							message: "Editable roles may only contain page read permissions",
						});
					if (
						ctx.path === "/organization/update-role" &&
						ctx.body?.data?.roleName
					)
						throw new APIError("BAD_REQUEST", {
							message:
								"Role keys are permanent; create a new role to change its key",
						});
				}
				if (ctx.path === "/organization/delete-role") {
					const body = ctx.body;
					const [role] = await db
						.select()
						.from(schema.organizationRole)
						.where(
							body.roleId
								? eq(schema.organizationRole.id, body.roleId)
								: and(
										eq(schema.organizationRole.organizationId, workspaceId),
										eq(schema.organizationRole.role, body.roleName),
									),
						);
					if (role?.role === defaultMemberRole)
						throw new APIError("FORBIDDEN", {
							message: "The registration role cannot be deleted",
						});
				}
			}),
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
