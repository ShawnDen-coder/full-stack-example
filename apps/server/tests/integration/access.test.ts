import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createAccessService } from "@full-stack-example/api/access";
import { createAuth } from "@full-stack-example/api/auth";
import { createDb } from "@full-stack-example/db";
import { member, organizationRole, user } from "@full-stack-example/db/schema";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const database = process.env.TEST_DATABASE_URL;
if (!database) throw new Error("Dedicated TEST_DATABASE_URL is required");
test("native Better Auth roles enforce page access and administrator boundaries", async () => {
	const db = createDb({ DATABASE_URL: database });
	await migrate(db, {
		migrationsFolder: fileURLToPath(
			new URL("../../../../packages/db/src/migrations", import.meta.url),
		),
	});
	const auth = createAuth({
		db,
		secret: "access-tests-only-secret-with-32-characters",
		baseURL: "http://localhost:3000",
		trustedOrigins: ["http://localhost:3001"],
	});
	const access = createAccessService(auth);
	const ids: string[] = [];
	const roleName = `test-${randomUUID()}`;
	async function post(path: string, body: unknown, cookie = "") {
		return auth.handler(
			new Request(`http://localhost:3000/api/auth/${path}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "http://localhost:3001",
					cookie,
				},
				body: JSON.stringify(body),
			}),
		);
	}
	async function signup(name: string) {
		const response = await post("sign-up/email", {
			email: `${randomUUID()}@example.test`,
			password: "test-only-password-123",
			name,
		});
		assert.equal(response.status, 200);
		const data = (await response.json()) as { user: { id: string } };
		ids.push(data.user.id);
		const cookie = response.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
		const [membership] = await db
			.select()
			.from(member)
			.where(eq(member.userId, data.user.id));
		assert.ok(membership);
		return {
			id: data.user.id as string,
			memberId: membership.id,
			cookie,
			headers: new Headers({ cookie }),
		};
	}
	try {
		const rejected = await post("sign-up/email", {
			email: `${randomUUID()}@example.test`,
			password: "test-only-password-123",
			name: "Injected",
			role: "superadmin",
		});
		assert.equal(rejected.status, 400);
		const owner = await signup("Owner");
		const manager = await signup("Manager");
		const ordinary = await signup("Member");
		// Deployment-only owner provisioning; all subsequent changes use native HTTP APIs.
		await db
			.update(member)
			.set({ role: "owner" })
			.where(eq(member.id, owner.memberId));
		assert.equal(
			(
				await post(
					"organization/update-member-role",
					{
						organizationId: "application",
						memberId: manager.memberId,
						role: "admin",
					},
					owner.cookie,
				)
			).status,
			200,
		);
		assert.equal(
			(
				await post(
					"organization/update-member-role",
					{
						organizationId: "application",
						memberId: ordinary.memberId,
						role: "admin",
					},
					manager.cookie,
				)
			).status,
			403,
		);
		assert.equal(
			(
				await post(
					"organization/update-member-role",
					{
						organizationId: "application",
						memberId: manager.memberId,
						role: "member",
					},
					manager.cookie,
				)
			).status,
			403,
		);
		assert.equal(
			(
				await post(
					"organization/update-member-role",
					{
						organizationId: "application",
						memberId: owner.memberId,
						role: "member",
					},
					owner.cookie,
				)
			).status,
			403,
		);
		assert.equal(
			(
				await post(
					"organization/create-role",
					{
						organizationId: "application",
						role: roleName,
						permission: { member: ["update"] },
					},
					manager.cookie,
				)
			).status,
			403,
		);
		assert.equal(
			(
				await post(
					"organization/create-role",
					{
						organizationId: "application",
						role: roleName,
						permission: { todos: ["read"] },
					},
					ordinary.cookie,
				)
			).status,
			403,
		);
		const created = await post(
			"organization/create-role",
			{
				organizationId: "application",
				role: roleName,
				permission: { todos: ["read"] },
			},
			manager.cookie,
		);
		assert.equal(created.status, 200);
		const { roleData } = (await created.json()) as { roleData: { id: string } };
		assert.equal(
			(
				await post(
					"organization/update-member-role",
					{
						organizationId: "application",
						memberId: ordinary.memberId,
						role: ["member", roleName],
					},
					manager.cookie,
				)
			).status,
			200,
		);
		assert.deepEqual((await access.getAccess(ordinary.headers)).pages, [
			"todos",
		]);
		assert.equal(await access.canReadPage(ordinary.headers, "todos"), true);
		assert.equal(
			(
				await post(
					"organization/update-role",
					{
						organizationId: "application",
						roleId: roleData.id,
						data: { permission: {} },
					},
					manager.cookie,
				)
			).status,
			200,
		);
		assert.deepEqual((await access.getAccess(ordinary.headers)).pages, []);
		assert.equal(await access.canReadPage(ordinary.headers, "todos"), false);
		assert.equal(
			(
				await post(
					"organization/delete-role",
					{ organizationId: "application", roleId: roleData.id },
					manager.cookie,
				)
			).status,
			400,
		);
		assert.equal(
			(
				await post(
					"organization/delete-role",
					{ organizationId: "application", roleName: "standard" },
					owner.cookie,
				)
			).status,
			403,
		);
		assert.equal(
			(
				await post(
					"organization/update-role",
					{
						organizationId: "application",
						roleId: roleData.id,
						data: { roleName: "renamed" },
					},
					manager.cookie,
				)
			).status,
			400,
		);
		assert.equal(
			(
				await post(
					"admin/set-role",
					{ userId: ordinary.id, role: "superadmin" },
					manager.cookie,
				)
			).status,
			403,
		);
		assert.equal(
			(
				await post(
					"organization/create",
					{ name: "Other", slug: randomUUID() },
					ordinary.cookie,
				)
			).status,
			403,
		);
		assert.equal(
			(
				await post(
					"organization/update-member-role",
					{
						organizationId: "application",
						memberId: manager.memberId,
						role: "member",
					},
					owner.cookie,
				)
			).status,
			200,
		);
		assert.equal((await access.getAccess(manager.headers)).role, "user");
		assert.equal(
			(
				await post(
					"organization/update-role",
					{
						organizationId: "application",
						roleId: roleData.id,
						data: { permission: { todos: ["read"] } },
					},
					manager.cookie,
				)
			).status,
			403,
		);

		for (const path of [
			"organization/delete",
			"organization/leave",
			"organization/remove-member",
		]) {
			assert.equal(
				(
					await post(
						path,
						{
							organizationId: "application",
							memberIdOrEmail: ordinary.memberId,
						},
						owner.cookie,
					)
				).status,
				403,
			);
		}
		await db
			.update(user)
			.set({ role: "superadmin" })
			.where(eq(user.id, owner.id));
		const listed = await auth.api.listUsers({
			headers: owner.headers,
			query: { limit: 1 },
		});
		assert.equal(listed.users.length, 1);
		await auth.api.banUser({
			headers: owner.headers,
			body: { userId: ordinary.id },
		});
		await assert.rejects(() => access.getAccess(ordinary.headers));
	} finally {
		await db.delete(user).where(inArray(user.id, ids));
		await db
			.delete(organizationRole)
			.where(eq(organizationRole.role, roleName));
		await db.close();
	}
});
