import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createApi } from "@full-stack-example/api/create-api";
import type { AppRouterClient } from "@full-stack-example/api/routers/index";
import {
	member,
	organization,
	organizationRole,
	user,
} from "@full-stack-example/db/schema";
import { createLogger } from "@full-stack-example/observability";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { and, eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createServices } from "../../src/services";

if (!process.env.TEST_DATABASE_URL || !process.env.TEST_REDIS_URL)
	throw new Error("Dedicated test services required");
test("workspace creation, membership, tools and Todo isolation form one authorization boundary", async () => {
	const logger = createLogger("test");
	logger.level = "silent";
	const runtime = await createServices(
		{
			DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
			REDIS_URL: process.env.TEST_REDIS_URL ?? "",
			BETTER_AUTH_SECRET: "workspace-test-secret-with-32-characters",
			BETTER_AUTH_URL: "http://localhost:3000",
			CORS_ORIGIN: "http://localhost:3001",
		},
		logger,
	);
	const { db, auth } = runtime;
	const ids: string[] = [];
	const spaceIds: string[] = [];
	try {
		await migrate(db, {
			migrationsFolder: fileURLToPath(
				new URL("../../../../packages/db/src/migrations", import.meta.url),
			),
		});
		const { app } = createApi({
			...runtime,
			corsOrigin: "http://localhost:3001",
			checkReady: runtime.checkReady,
		});
		const rpc = (cookie: string): AppRouterClient =>
			createORPCClient(
				new RPCLink({
					url: "http://localhost:3000/rpc",
					fetch: async (request, init) =>
						app.fetch(
							new Request(request, {
								...init,
								headers: new Headers([...request.headers, ["cookie", cookie]]),
							}),
						),
				}),
			);
		async function signup(name: string) {
			const email = `${randomUUID()}@example.test`;
			const response = await auth.handler(
				new Request("http://localhost:3000/api/auth/sign-up/email", {
					method: "POST",
					headers: {
						"content-type": "application/json",
						origin: "http://localhost:3001",
					},
					body: JSON.stringify({
						name,
						email,
						password: "workspace-test-password",
					}),
				}),
			);
			assert.equal(response.status, 200);
			const data = (await response.json()) as { user: { id: string } };
			ids.push(data.user.id);
			const cookie = response.headers
				.getSetCookie()
				.map((entry) => entry.split(";")[0])
				.join("; ");
			return { id: data.user.id, email, cookie, client: rpc(cookie) };
		}
		const platform = await signup("Platform");
		const owner = await signup("Owner");
		const outsider = await signup("Outsider");
		assert.deepEqual(await owner.client.access.mine(), []);
		assert.equal((await owner.client.access.me()).organizationId, undefined);
		await db
			.update(user)
			.set({ role: "superadmin" })
			.where(eq(user.id, platform.id));
		await assert.rejects(
			() =>
				owner.client.access.createWorkspace({
					name: "Denied",
					slug: randomUUID(),
					ownerEmail: owner.email,
					tools: ["todos"],
				}),
			{ code: "FORBIDDEN" },
		);
		const create = (name: string) =>
			platform.client.access.createWorkspace({
				name,
				slug: randomUUID(),
				ownerEmail: owner.email,
				tools: ["todos"],
			});
		const a = await create("A");
		spaceIds.push(a.id);
		const b = await create("B");
		spaceIds.push(b.id);
		assert.equal((await owner.client.access.mine()).length, 2);
		assert.deepEqual(await platform.client.access.mine(), []);
		assert.equal(
			(await platform.client.access.workspaces({})).items.some(
				(space) => space.id === a.id,
			),
			true,
		);
		await assert.rejects(() => owner.client.access.workspaces({}), {
			code: "FORBIDDEN",
		});
		for (const client of [platform.client, outsider.client])
			await assert.rejects(() => client.todo.list({ workspaceId: a.id }), {
				code: "FORBIDDEN",
			});
		assert.equal(
			(await owner.client.access.me({ workspaceId: a.id })).platformRole,
			"user",
		);
		await assert.rejects(() => owner.client.queues.list(), {
			code: "FORBIDDEN",
		});
		const task = await owner.client.todo.create({
			workspaceId: a.id,
			text: "A only",
		});
		assert.deepEqual(
			(await owner.client.todo.list({ workspaceId: b.id })).items,
			[],
		);
		await assert.rejects(
			() =>
				owner.client.todo.rename({
					workspaceId: b.id,
					id: task.id,
					text: "cross",
				}),
			{ code: "NOT_FOUND" },
		);
		await assert.rejects(
			() => owner.client.todo.delete({ workspaceId: b.id, id: task.id }),
			{ code: "NOT_FOUND" },
		);
		await owner.client.access.addMember({
			workspaceId: a.id,
			email: outsider.email,
		});
		await owner.client.access.addMember({
			workspaceId: a.id,
			email: outsider.email,
		});
		assert.equal((await outsider.client.access.mine()).length, 1);
		assert.deepEqual(
			(await outsider.client.todo.list({ workspaceId: a.id })).items,
			[],
		);
		await assert.rejects(
			() =>
				outsider.client.access.addMember({
					workspaceId: b.id,
					email: platform.email,
				}),
			{ code: "FORBIDDEN" },
		);
		await platform.client.access.setTool({
			workspaceId: a.id,
			tool: "todos",
			enabled: false,
		});
		assert.deepEqual(
			(await owner.client.access.me({ workspaceId: a.id })).pages.filter(
				(page) => page === "todos",
			),
			[],
		);
		await assert.rejects(
			() => owner.client.todo.create({ workspaceId: a.id, text: "disabled" }),
			{ code: "FORBIDDEN" },
		);
		await platform.client.access.setTool({
			workspaceId: a.id,
			tool: "todos",
			enabled: true,
		});
		assert.equal(
			(await owner.client.todo.list({ workspaceId: a.id })).items[0]?.text,
			"A only",
		);
		const [target] = await db
			.select()
			.from(member)
			.where(
				and(eq(member.organizationId, a.id), eq(member.userId, outsider.id)),
			);
		const [roleB] = await db
			.select()
			.from(organizationRole)
			.where(eq(organizationRole.organizationId, b.id));
		assert.ok(target && roleB);
		async function native(path: string, body: unknown) {
			return auth.handler(
				new Request(`http://localhost:3000/api/auth/organization/${path}`, {
					method: "POST",
					headers: {
						"content-type": "application/json",
						origin: "http://localhost:3001",
						cookie: owner.cookie,
					},
					body: JSON.stringify(body),
				}),
			);
		}
		assert.equal(
			(
				await native("update-member-role", {
					organizationId: b.id,
					memberId: target.id,
					role: "admin",
				})
			).status,
			403,
		);
		assert.equal(
			(
				await native("update-role", {
					organizationId: a.id,
					roleId: roleB.id,
					data: { permission: { todos: ["read"] } },
				})
			).status,
			403,
		);
		assert.equal(
			(
				await native("update-role", {
					organizationId: b.id,
					roleId: roleB.id,
					permission: {},
					data: { permission: { member: ["update"] } },
				})
			).status,
			403,
		);
		assert.equal(
			(
				await native("remove-member", {
					organizationId: a.id,
					memberIdOrEmail: target.id,
				})
			).status,
			403,
		);
		assert.equal(
			(
				await native("delete-role", {
					organizationId: b.id,
					roleId: roleB.id,
					roleName: "standard",
				})
			).status,
			400,
		);
		await assert.rejects(() =>
			auth.api.banUser({
				headers: new Headers({ cookie: platform.cookie }),
				body: { userId: owner.id },
			}),
		);
		const [activeOwner] = await db
			.select()
			.from(user)
			.where(eq(user.id, owner.id));
		assert.equal(activeOwner?.banned, false);
		const raceOwner = await signup("Concurrent owner");
		const raceSpaceId = randomUUID();
		spaceIds.push(raceSpaceId);
		let locked = () => {};
		let commit = () => {};
		const acquired = new Promise<void>((resolve) => {
			locked = resolve;
		});
		const proceed = new Promise<void>((resolve) => {
			commit = resolve;
		});
		// Simulate an in-flight creation holding the same user row as createWorkspace.
		const creating = db.transaction(async (tx) => {
			await tx
				.select()
				.from(user)
				.where(eq(user.id, raceOwner.id))
				.for("update");
			locked();
			await proceed;
			await tx.insert(organization).values({
				id: raceSpaceId,
				name: "Concurrent",
				slug: raceSpaceId,
				createdAt: new Date(),
			});
			await tx.insert(member).values({
				id: randomUUID(),
				organizationId: raceSpaceId,
				userId: raceOwner.id,
				role: "owner",
				createdAt: new Date(),
			});
		});
		await acquired;
		const banning = auth.api
			.banUser({
				headers: new Headers({ cookie: platform.cookie }),
				body: { userId: raceOwner.id },
			})
			.then(
				() => true,
				() => false,
			);
		await new Promise((resolve) => setTimeout(resolve, 100));
		commit();
		await creating;
		assert.equal(
			await banning,
			false,
			"a ban waiting on owner creation must recheck ownership",
		);
		const [raceAccount] = await db
			.select()
			.from(user)
			.where(eq(user.id, raceOwner.id));
		assert.equal(raceAccount?.banned, false);
		const duplicate = {
			name: "Duplicate",
			slug: a.slug,
			ownerEmail: owner.email,
			tools: ["todos" as const],
		};
		await assert.rejects(
			() => platform.client.access.createWorkspace(duplicate),
			{ code: "CONFLICT" },
		);
		assert.equal((await owner.client.access.mine()).length, 2);
		await db.delete(member).where(eq(member.id, target.id));
		await assert.rejects(
			() => outsider.client.todo.list({ workspaceId: a.id }),
			{ code: "FORBIDDEN" },
		);
	} finally {
		// User cascade removes personal tasks before restricted workspace deletion.
		await db.delete(user).where(inArray(user.id, ids));
		if (spaceIds.length)
			await db.delete(organization).where(inArray(organization.id, spaceIds));
		await runtime.close();
	}
});
