import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createApi } from "@full-stack-example/api/create-api";
import type { AppRouterClient } from "@full-stack-example/api/routers/index";
import { createDb } from "@full-stack-example/db";
import {
	member,
	organization,
	organizationRole,
	session,
	user,
} from "@full-stack-example/db/schema";
import { createLogger } from "@full-stack-example/observability";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { and, eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import sharp from "sharp";
import { createServices } from "../../src/services";

if (!process.env.TEST_DATABASE_URL || !process.env.TEST_REDIS_URL)
	throw new Error("Dedicated test services required");
test("workspace creation, membership, tools and Todo isolation form one authorization boundary", async () => {
	const logger = createLogger("test");
	logger.level = "silent";
	let db!: ReturnType<typeof createDb>;
	const runtime = await createServices(
		{
			DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
			REDIS_URL: process.env.TEST_REDIS_URL ?? "",
			BETTER_AUTH_SECRET: "workspace-test-secret-with-32-characters",
			BETTER_AUTH_URL: "http://localhost:3000",
			CORS_ORIGIN: "http://localhost:3001",
		},
		logger,
		{
			createDb: (...args) => {
				db = createDb(...args);
				return db;
			},
		},
	);
	const { auth } = runtime;
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
		const pixels = Buffer.alloc(64 * 64 * 3);
		for (let y = 0; y < 64; y++) {
			for (let x = 0; x < 64; x++) {
				const offset = (y * 64 + x) * 3;
				pixels[offset] = x * 4;
				pixels[offset + 1] = y * 4;
				pixels[offset + 2] = (x + y) * 2;
			}
		}
		const gradient = await sharp(pixels, {
			raw: { width: 64, height: 64, channels: 3 },
		})
			.png()
			.toBuffer();
		await owner.client.access.updateWorkspaceBasics({
			workspaceId: a.id,
			name: "Renamed A",
			logo: `data:image/png;base64,${gradient.toString("base64")}`,
		});
		const savedLogo = (
			await owner.client.access.workspaceLogo({ workspaceId: a.id })
		).logo;
		await owner.client.access.updateWorkspaceBasics({
			workspaceId: a.id,
			name: "Name only",
			logo: savedLogo,
		});
		assert.ok(
			(await owner.client.access.workspaceLogo({ workspaceId: a.id })).logo ===
				savedLogo,
			"renaming must preserve the exact stored logo bytes",
		);
		await owner.client.access.updateWorkspaceBasics({
			workspaceId: a.id,
			name: "Renamed A",
			logo: savedLogo,
		});
		assert.match(
			(await owner.client.access.workspaceLogo({ workspaceId: a.id })).logo ??
				"",
			/^data:image\/webp;base64,/,
		);
		assert.equal(
			(await owner.client.access.mine()).find((space) => space.id === a.id)
				?.name,
			"Renamed A",
		);
		// Valid two-frame APNG: sharp exposes only its first frame as PNG.
		const apng =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAABAAAAAQAAAAAAAAAAAAEACgAAWn8w0AAAAA1JREFUeJxj+M/A8B8ABQAB/4mZPR0AAAAaZmNUTAAAAAEAAAABAAAAAQAAAAAAAAAAAAEACgAAwQzaBAAAABFmZEFUAAAAAnicY2Bg+P8fAAMCAf/1e6XXAAAAAElFTkSuQmCC";
		await assert.rejects(
			() =>
				owner.client.access.updateWorkspaceBasics({
					workspaceId: a.id,
					name: "Animated input",
					logo: apng,
				}),
			{ code: "BAD_REQUEST" },
		);
		assert.equal(
			(await owner.client.access.workspaceLogo({ workspaceId: a.id })).logo,
			savedLogo,
		);
		await assert.rejects(
			() => outsider.client.access.workspaceLogo({ workspaceId: a.id }),
			{ code: "FORBIDDEN" },
		);
		await assert.rejects(
			() =>
				outsider.client.access.updateWorkspaceBasics({
					workspaceId: a.id,
					name: "Denied",
					logo: null,
				}),
			{ code: "FORBIDDEN" },
		);
		await assert.rejects(
			() =>
				owner.client.access.updateWorkspaceBasics({
					workspaceId: a.id,
					name: "Invalid",
					logo: "data:image/png;base64,YWJj",
				}),
			{ code: "BAD_REQUEST" },
		);
		assert.equal(
			(await owner.client.access.mine()).find((space) => space.id === a.id)
				?.name,
			"Renamed A",
		);
		for (const prefix of ["/rpc", "/api-reference"]) {
			for (const procedure of ["createWorkspace", "updateWorkspaceBasics"]) {
				const input =
					procedure === "createWorkspace"
						? {
								name: "Too large",
								slug: randomUUID(),
								ownerEmail: owner.email,
								tools: [],
							}
						: { workspaceId: a.id, name: "Too large", logo: null };
				const body =
					JSON.stringify(prefix === "/rpc" ? { json: input } : input) +
					" ".repeat(70_000);
				for (const suffix of ["", "/", "//"]) {
					const path = `${prefix}/access/${procedure}${suffix}`;
					assert.equal(
						(
							await app.request(path, {
								method: "POST",
								headers: {
									"content-type": "application/json",
									cookie: platform.cookie,
								},
								body,
							})
						).status,
						413,
						`${path} must enforce the body limit before JSON parsing`,
					);
				}
			}
		}
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array(70_000));
				controller.close();
			},
		});
		const streamed = new Request(
			"http://localhost:3000/rpc/access/updateWorkspaceBasics",
			{
				method: "POST",
				headers: { "content-type": "application/json", cookie: owner.cookie },
				body: stream,
				duplex: "half",
			} as RequestInit,
		);
		assert.equal((await app.fetch(streamed)).status, 413);
		await platform.client.access.updateWorkspaceBasics({
			workspaceId: a.id,
			name: "A",
			logo: null,
		});
		assert.equal(
			(await owner.client.access.workspaceLogo({ workspaceId: a.id })).logo,
			null,
		);
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
		await assert.rejects(
			() =>
				outsider.client.access.updateWorkspaceBasics({
					workspaceId: a.id,
					name: "Denied member",
					logo: null,
				}),
			{ code: "FORBIDDEN" },
		);
		await db
			.update(member)
			.set({ role: "admin,standard" })
			.where(
				and(eq(member.organizationId, a.id), eq(member.userId, outsider.id)),
			);
		await outsider.client.access.updateWorkspaceBasics({
			workspaceId: a.id,
			name: "Admin updated",
			logo: null,
		});
		await assert.rejects(
			() =>
				outsider.client.access.updateWorkspaceBasics({
					workspaceId: b.id,
					name: "Other",
					logo: null,
				}),
			{ code: "FORBIDDEN" },
		);
		await assert.rejects(
			() =>
				outsider.client.access.setTool({
					workspaceId: a.id,
					tool: "todos",
					enabled: false,
				}),
			{ code: "FORBIDDEN" },
		);
		await db
			.update(member)
			.set({ role: "member,standard" })
			.where(
				and(eq(member.organizationId, a.id), eq(member.userId, outsider.id)),
			);
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
		const bannedAccount = await signup("Banned account");
		assert.ok(
			await auth.api.getSession({
				headers: new Headers({ cookie: bannedAccount.cookie }),
			}),
		);
		await auth.api.banUser({
			headers: new Headers({ cookie: platform.cookie }),
			body: { userId: bannedAccount.id },
		});
		const [bannedUser] = await db
			.select()
			.from(user)
			.where(eq(user.id, bannedAccount.id));
		assert.equal(bannedUser?.banned, true);
		assert.deepEqual(
			await db
				.select()
				.from(session)
				.where(eq(session.userId, bannedAccount.id)),
			[],
		);
		assert.equal(
			await auth.api.getSession({
				headers: new Headers({ cookie: bannedAccount.cookie }),
			}),
			null,
		);
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
