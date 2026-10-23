import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createApi } from "@my-better-t-app/api/create-api";
import type { AppRouterClient } from "@my-better-t-app/api/routers/index";
import { createDb } from "@my-better-t-app/db";
import { user } from "@my-better-t-app/db/schema/auth";
import { createLogger } from "@my-better-t-app/logger";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { z } from "zod";
import { startWorker } from "../../../worker/src/runtime";
import { startServer } from "../../src/runtime";
import { createServices } from "../../src/services";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const REDIS_URL = process.env.TEST_REDIS_URL;
if (!DATABASE_URL || !REDIS_URL)
	throw new Error(
		"TEST_DATABASE_URL and TEST_REDIS_URL must point to dedicated test services",
	);
const config = {
	DATABASE_URL,
	REDIS_URL,
	BETTER_AUTH_SECRET: "integration-only-secret-at-least-32-characters",
	BETTER_AUTH_URL: "http://localhost:3000",
	CORS_ORIGIN: "http://localhost:3001",
};
const logger = createLogger("integration");
logger.level = "silent";
const migrationsFolder = fileURLToPath(
	new URL("../../../../packages/db/src/migrations", import.meta.url),
);

async function eventually<T>(
	read: () => Promise<T>,
	accept: (value: T) => boolean,
): Promise<T> {
	const deadline = Date.now() + 15000;
	while (true) {
		const value = await read();
		if (accept(value)) return value;
		if (Date.now() > deadline) throw new Error("Condition did not become true");
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
}

test("migrations, real authentication, owner isolation, pagination and independent worker", {
	timeout: 60000,
}, async () => {
	const runtime = createServices(config, logger);
	const identities: string[] = [];
	let worker: Awaited<ReturnType<typeof startWorker>> | undefined;
	try {
		await migrate(runtime.db, { migrationsFolder });
		await migrate(runtime.db, { migrationsFolder });
		await runtime.checkReady();
		worker = await startWorker(
			{ ...config, WORKER_CONCURRENCY: 2, WORKER_STARTUP_TIMEOUT_MS: 5000 },
			undefined,
			logger,
		);
		const { app } = createApi({
			...runtime,
			corsOrigin: config.CORS_ORIGIN,
			checkReady: runtime.checkReady,
		});
		const cookieClient = (cookie = ""): AppRouterClient =>
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
		async function register(name: string) {
			const email = `${randomUUID()}@example.test`;
			const response = await app.request("/api/auth/sign-up/email", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: config.CORS_ORIGIN,
				},
				body: JSON.stringify({ name, email, password: "integration-password" }),
			});
			assert.equal(response.status, 200);
			const body = z
				.object({ user: z.object({ id: z.string() }) })
				.parse(await response.json());
			identities.push(body.user.id);
			const cookie = response.headers
				.getSetCookie()
				.map((value) => value.split(";")[0])
				.join("; ");
			assert.ok(cookie);
			return { client: cookieClient(cookie), cookie, email };
		}
		const a = await register("Alice");
		const b = await register("Bob");
		await assert.rejects(() => cookieClient().todo.list({}), {
			code: "UNAUTHORIZED",
		});
		const one = await a.client.todo.create({ text: "  first  " });
		assert.equal(one.text, "first");
		const two = await a.client.todo.create({ text: "second" });
		const three = await a.client.todo.create({ text: "third" });
		await b.client.todo.create({ text: "Bob only" });
		const page1 = await a.client.todo.list({ limit: 2 });
		assert.deepEqual(
			page1.items.map((item) => item.id),
			[three.id, two.id],
		);
		assert.equal(page1.nextCursor, two.id);
		const page2 = await a.client.todo.list({
			cursor: page1.nextCursor ?? undefined,
			limit: 2,
		});
		assert.deepEqual(
			page2.items.map((item) => item.id),
			[one.id],
		);
		assert.equal(page2.nextCursor, null);
		await assert.rejects(
			() => b.client.todo.toggle({ id: one.id, completed: true }),
			{ code: "NOT_FOUND" },
		);
		await assert.rejects(() => b.client.todo.delete({ id: one.id }), {
			code: "NOT_FOUND",
		});
		await assert.rejects(() => a.client.todo.create({ text: " " }), {
			code: "BAD_REQUEST",
		});
		await assert.rejects(
			() => a.client.todo.create({ text: "x".repeat(501) }),
			{ code: "BAD_REQUEST" },
		);
		await assert.rejects(() => a.client.todo.list({ limit: 101 }), {
			code: "BAD_REQUEST",
		});
		await assert.rejects(
			() => a.client.todo.toggle({ id: 1.5, completed: true }),
			{ code: "BAD_REQUEST" },
		);
		assert.equal(
			(await a.client.todo.toggle({ id: one.id, completed: true })).completed,
			true,
		);
		assert.deepEqual(await a.client.todo.delete({ id: one.id }), {
			id: one.id,
		});
		await assert.rejects(() => a.client.todo.delete({ id: one.id }), {
			code: "NOT_FOUND",
		});
		const job = await a.client.users.requestProfile();
		await assert.rejects(() => b.client.users.profileJob(job), {
			code: "NOT_FOUND",
		});
		const completed = await eventually(
			() => a.client.users.profileJob(job),
			(value) => value.state === "completed",
		);
		assert.deepEqual(completed.result, {
			id: identities[0],
			name: "Alice",
			emailVerified: false,
		});
		const signout = await app.request("/api/auth/sign-out", {
			method: "POST",
			headers: { Cookie: a.cookie, Origin: config.CORS_ORIGIN },
		});
		assert.equal(signout.status, 200);
		await assert.rejects(() => a.client.todo.list({}), {
			code: "UNAUTHORIZED",
		});
		const login = await app.request("/api/auth/sign-in/email", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: config.CORS_ORIGIN,
			},
			body: JSON.stringify({
				email: a.email,
				password: "integration-password",
			}),
		});
		assert.equal(login.status, 200);
		assert.ok(login.headers.getSetCookie().length);
		assert.equal((await app.request("/ready")).status, 200);
	} finally {
		await worker?.close();
		for (const id of identities)
			await runtime.db.delete(user).where(eq(user.id, id));
		await runtime.close();
	}
});

test("database statement timeout and idle connection failure recover without crashing", {
	timeout: 15000,
}, async () => {
	const db = createDb(config, { logger, queryTimeoutMillis: 100 });
	const admin = createDb(config, { logger });
	try {
		await assert.rejects(() => db.$client.query("SELECT pg_sleep(2)"));
		const client = await db.$client.connect();
		const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0]
			.pid;
		const failed = new Promise<void>((resolve) =>
			db.$client.once("error", () => resolve()),
		);
		client.release();
		await admin.$client.query("SELECT pg_terminate_backend($1)", [pid]);
		await failed;
		assert.equal((await db.$client.query("SELECT 1 AS ok")).rows[0].ok, 1);
	} finally {
		await db.$client.end();
		await admin.$client.end();
	}
});

test("server starts on ready dependencies and closes idempotently", {
	timeout: 15000,
}, async () => {
	const runtime = await startServer(
		{
			...config,
			PORT: 0,
			SERVER_STARTUP_TIMEOUT_MS: 5000,
			SERVER_SHUTDOWN_TIMEOUT_MS: 5000,
		},
		logger,
	);
	const address = runtime.server.address();
	assert.ok(address && typeof address !== "string");
	assert.equal(
		(await fetch(`http://127.0.0.1:${address.port}/ready`)).status,
		200,
	);
	const first = runtime.close();
	assert.equal(runtime.close(), first);
	await first;
});

test("server and worker processes drain on SIGTERM", {
	timeout: 90000,
}, async () => {
	for (const app of ["server", "worker"]) {
		const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
			cwd: fileURLToPath(new URL(`../../../${app}/`, import.meta.url)),
			env: { ...process.env, ...config, NODE_ENV: "test", PORT: "0" },
			stdio: ["ignore", "pipe", "pipe"],
		});
		try {
			const exited = new Promise<number | null>((resolve) =>
				child.once("exit", resolve),
			);
			await new Promise<void>((resolve, reject) => {
				let output = "";
				const timer = setTimeout(
					() => reject(new Error(`${app} did not become ready: ${output}`)),
					30000,
				);
				child.once("exit", () => {
					clearTimeout(timer);
					reject(new Error(`${app} exited before readiness`));
				});
				child.stdout.on("data", (chunk) => {
					output += chunk;
					if (
						output.includes(
							app === "server" ? "Server ready" : "User profile worker ready",
						)
					) {
						clearTimeout(timer);
						resolve();
					}
				});
			});
			child.kill("SIGTERM");
			assert.equal(await exited, 0);
		} finally {
			if (child.exitCode === null) child.kill("SIGKILL");
		}
	}
});

test("failed jobs use bounded retries and expose no internal failure details", {
	timeout: 15000,
}, async () => {
	const { createUserProfileWorker } = await import(
		"@my-better-t-app/users/workers/user-profile.worker"
	);
	const runtime = createServices(config, logger);
	let attempts = 0;
	const worker = createUserProfileWorker({
		redisUrl: config.REDIS_URL,
		logger,
		usersService: {
			getProfile: async () => {
				attempts++;
				throw new Error("internal test failure");
			},
		},
	});
	try {
		await worker.waitUntilReady();
		const owner = `failure-${randomUUID()}`;
		const owned = await runtime.services.queueClient.enqueueUserProfile(
			owner,
			"retry-test",
		);
		const state = await eventually(
			() => runtime.services.queueClient.getUserProfileJob(owned.id, owner),
			(value) => value?.state === "failed",
		);
		assert.equal(state?.result, null);
		assert.ok(!JSON.stringify(state).includes("internal test failure"));
		assert.equal(attempts, 3);
		assert.equal(
			await runtime.services.queueClient.getUserProfileJob(owned.id, "foreign"),
			null,
		);
	} finally {
		await worker.close();
		await runtime.close();
	}
});

test("server startup fails within its deadline when PostgreSQL is unavailable", {
	timeout: 10000,
}, async () => {
	await assert.rejects(() =>
		startServer(
			{
				...config,
				DATABASE_URL: "postgresql://postgres:unused@127.0.0.1:1/unavailable",
				PORT: 0,
				SERVER_STARTUP_TIMEOUT_MS: 100,
				SERVER_SHUTDOWN_TIMEOUT_MS: 1000,
			},
			logger,
		),
	);
});
