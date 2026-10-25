import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { Session } from "@full-stack-example/api/auth";
import type { ContextDependencies } from "@full-stack-example/api/context";
import { createApi } from "@full-stack-example/api/create-api";
import type { AppRouterClient } from "@full-stack-example/api/routers/index";
import { createTodosService } from "@full-stack-example/business/todos";
import { createDb } from "@full-stack-example/db";
import { createLogger } from "@full-stack-example/observability";
import { createQueueConnection } from "@full-stack-example/queue";
import { serve } from "@hono/node-server";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

const now = new Date("2026-01-01T00:00:00Z");
const profile = {
	id: "user-1",
	name: "Alice",
	email: "alice@example.test",
	emailVerified: true,
	image: null,
	createdAt: now,
};
const session: Session = {
	user: { ...profile, updatedAt: now },
	session: {
		id: "session-1",
		userId: profile.id,
		token: "test-session",
		createdAt: now,
		updatedAt: now,
		expiresAt: new Date("2099-01-01"),
	},
};

async function fixture(currentSession: Session | null = session) {
	const calls: string[] = [];
	const sessionHeaders: Headers[] = [];
	// Creating a pool is lazy; these HTTP tests never connect to PostgreSQL.
	const db = createDb({ DATABASE_URL: "postgresql://localhost/unused" });
	const logger = createLogger("test");
	logger.level = "silent";
	const deps: ContextDependencies = {
		logger,
		auth: {
			handler: async (request) => {
				const headers = new Headers();
				headers.append("Set-Cookie", "session=test; Path=/; HttpOnly");
				headers.append("Set-Cookie", "csrf=test; Path=/");
				return new Response(
					request.method === "POST" ? await request.text() : "auth handler",
					{ headers },
				);
			},
		},
		getSession: async (headers) => {
			sessionHeaders.push(headers);
			calls.push("session");
			return currentSession;
		},
		services: {
			todosService: createTodosService({ db }),
			usersService: {
				getProfile: async (id) => {
					calls.push(`profile:${id}`);
					return profile;
				},
			},
			profileJobs: {
				enqueueProfileRead: async ({ userId: id }) => {
					calls.push(`enqueue:${id}`);
					return { id: "job-1" };
				},
				getProfileReadJob: async ({ jobId: id, userId }) => {
					calls.push(`job:${id}:${userId}`);
					return null;
				},
			},
		},
	};
	const { app } = createApi({
		...deps,
		corsOrigin: "http://localhost:3001",
		checkReady: async () => {},
	});
	const server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" });
	try {
		await new Promise<void>((resolve, reject) => {
			server.once("error", reject);
			if (server.listening) resolve();
			else server.once("listening", resolve);
		});
	} catch (error) {
		await db.$client.end();
		throw error;
	}
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("Missing server address");
	const baseURL = `http://127.0.0.1:${address.port}`;
	const request = (path: string, init?: RequestInit) =>
		fetch(new URL(path, baseURL), init);
	const client: AppRouterClient = createORPCClient(
		new RPCLink({
			url: `${baseURL}/rpc`,
		}),
	);
	return {
		request,
		client,
		calls,
		deps,
		db,
		sessionHeaders,
		async close() {
			try {
				await new Promise<void>((resolve, reject) =>
					server.close((error) => (error ? reject(error) : resolve())),
				);
			} finally {
				await db.$client.end();
			}
		},
	};
}

test("health and unknown routes do not resolve authentication or touch services", async () => {
	const f = await fixture();
	try {
		assert.equal((await f.request("/health")).status, 200);
		const head = await f.request("/health", { method: "HEAD" });
		assert.equal(head.status, 200);
		assert.equal(await head.text(), "");
		assert.equal((await f.request("/missing")).status, 404);
		assert.deepEqual(f.calls, []);
	} finally {
		await f.close();
	}
});

test("auth requests are delegated to the injected Better Auth handler", async () => {
	const f = await fixture();
	try {
		const response = await f.request("/api/auth/get-session");
		assert.equal(await response.text(), "auth handler");
		assert.deepEqual(f.calls, []);
	} finally {
		await f.close();
	}
});

test("anonymous requests cannot read profiles or enqueue and inspect jobs", async () => {
	const f = await fixture(null);
	try {
		for (const request of [
			() => f.client.users.me(),
			() => f.client.users.requestProfile(),
			() => f.client.users.profileJob({ id: "job-1" }),
		]) {
			await assert.rejects(request, { code: "UNAUTHORIZED" });
		}
		assert.ok(f.calls.every((call) => call === "session"));
	} finally {
		await f.close();
	}
});

test("anonymous requests cannot access any Todo operation", async () => {
	const f = await fixture(null);
	try {
		for (const request of [
			() => f.client.todo.list({}),
			() => f.client.todo.create({ text: "private" }),
			() => f.client.todo.toggle({ id: 1, completed: true }),
			() => f.client.todo.setCompleted({ id: 1, completed: true }),
			() => f.client.todo.delete({ id: 1 }),
		]) {
			await assert.rejects(request, { code: "UNAUTHORIZED" });
		}
	} finally {
		await f.close();
	}
});

test("Todo SQL binds the session owner for reads, inserts and mutations", async () => {
	const f = await fixture();
	const queries: unknown[][] = [];
	const query = mock.method(
		f.db.$client,
		"query",
		async (...args: unknown[]) => {
			queries.push(args);
			return { rows: [[99, "private", false]], rowCount: 1 };
		},
	);
	try {
		await f.client.todo.list({});
		await f.client.todo.create({ text: "private", userId: "foreign" } as {
			text: string;
		});
		await f.client.todo.toggle({ id: 99, completed: true });
		await f.client.todo.delete({ id: 99 });
		assert.equal(queries.length, 4);
		for (const [index, args] of queries.entries()) {
			const sql = (args[0] as { text: string }).text;
			const values = args[1] as unknown[];
			assert.ok(values.includes("user-1"));
			assert.ok(!values.includes("foreign"));
			if (index !== 1) assert.match(sql, /where.*"user_id" = \$\d+/);
			if (index >= 2) {
				assert.match(sql, /where.*"user_id" = \$\d+\)* and .*"id" = \$\d+/);
				assert.ok(values.includes(99));
			}
		}
	} finally {
		query.mock.restore();
		await f.close();
	}
});

test("profile and queue routes use the authenticated user ID", async () => {
	const f = await fixture();
	try {
		assert.equal((await f.client.users.me()).id, profile.id);
		assert.deepEqual(await f.client.users.requestProfile(), { id: "job-1" });
		assert.deepEqual(await f.client.users.enqueueProfileRead(), {
			id: "job-1",
		});
		await assert.rejects(() => f.client.users.profileJob({ id: "job-1" }), {
			code: "NOT_FOUND",
		});
		assert.ok(f.calls.includes("profile:user-1"));
		assert.ok(f.calls.includes("enqueue:user-1"));
		assert.ok(f.calls.includes("job:job-1:user-1"));
	} finally {
		await f.close();
	}
});

test("Redis connection supports TLS, database selection and rejects invalid protocols", () => {
	const connection = createQueueConnection("rediss://localhost:6380/2");
	assert.ok("host" in connection);
	if ("host" in connection) {
		assert.equal(connection.port, 6380);
		assert.equal(connection.db, 2);
		assert.equal(connection.commandTimeout, 2000);
		const worker = createQueueConnection("redis://localhost", "worker");
		assert.equal(worker.maxRetriesPerRequest, null);
		assert.equal(worker.commandTimeout, undefined);
		assert.deepEqual(connection.tls, {});
	}
	assert.throws(() => createQueueConnection("https://localhost"));
	assert.throws(() =>
		createQueueConnection("redis://localhost/not-a-database"),
	);
});

test("CORS preflight returns before auth and service resolution", async () => {
	const f = await fixture();
	try {
		const response = await f.request("/rpc/users/me", {
			method: "OPTIONS",
			headers: {
				Origin: "http://localhost:3001",
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "Content-Type",
			},
		});
		assert.equal(response.status, 204);
		assert.equal(
			response.headers.get("Access-Control-Allow-Origin"),
			"http://localhost:3001",
		);
		assert.equal(
			response.headers.get("Access-Control-Allow-Credentials"),
			"true",
		);
		assert.match(
			response.headers.get("Access-Control-Allow-Headers") ?? "",
			/Content-Type/,
		);
		assert.deepEqual(f.calls, []);
		const foreign = await f.request("/health", {
			headers: { Origin: "https://foreign.example.test" },
		});
		assert.equal(foreign.headers.get("Access-Control-Allow-Origin"), null);
		assert.match(foreign.headers.get("Vary") ?? "", /Origin/);
	} finally {
		await f.close();
	}
});

test("Hono auth mounting preserves POST bodies and multiple cookies", async () => {
	const f = await fixture();
	try {
		const body = JSON.stringify({ email: "alice@example.test" });
		const response = await f.request("/api/auth/sign-in/email", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "http://localhost:3001",
			},
			body,
		});
		assert.equal(await response.text(), body);
		assert.equal(response.headers.getSetCookie().length, 2);
		assert.equal(
			response.headers.get("Access-Control-Allow-Origin"),
			"http://localhost:3001",
		);
		assert.deepEqual(f.calls, []);
	} finally {
		await f.close();
	}
});

test("Hono RPC adapter forwards session cookies and retains CORS headers", async () => {
	const f = await fixture();
	try {
		const response = await f.request("/rpc/users/me", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: "session=test",
				Origin: "http://localhost:3001",
			},
			body: JSON.stringify({ json: null }),
		});
		assert.equal(response.status, 200);
		assert.equal(f.sessionHeaders[0]?.get("cookie"), "session=test");
		assert.equal(
			response.headers.get("Access-Control-Allow-Credentials"),
			"true",
		);
	} finally {
		await f.close();
	}
});

test("OpenAPI reference remains available and similar prefixes do not match", async () => {
	const f = await fixture();
	try {
		const response = await f.request("/api-reference");
		assert.equal(response.status, 200);
		assert.match(response.headers.get("Content-Type") ?? "", /text\/html/);
		const before = f.calls.length;
		assert.equal((await f.request("/rpc-other")).status, 404);
		assert.equal(f.calls.length, before);
	} finally {
		await f.close();
	}
});

test("readiness distinguishes dependency failure and draining without resolving sessions", async () => {
	const f = await fixture();
	try {
		let available = true;
		let accepting = true;
		const { app } = createApi({
			...f.deps,
			corsOrigin: "http://localhost:3001",
			isReady: () => accepting,
			checkReady: async () => {
				if (!available) throw new Error("dependency unavailable");
			},
		});
		const ready = await app.request("/ready");
		assert.equal(ready.status, 200);
		assert.ok(ready.headers.get("X-Request-ID"));
		available = false;
		assert.equal((await app.request("/ready")).status, 503);
		assert.equal((await app.request("/health")).status, 200);
		available = true;
		accepting = false;
		assert.equal((await app.request("/ready")).status, 503);
		assert.deepEqual(f.calls, []);
	} finally {
		await f.close();
	}
});

test("readiness has a deadline even when a dependency never settles", async () => {
	const f = await fixture();
	try {
		const { app } = createApi({
			...f.deps,
			corsOrigin: "http://localhost:3001",
			checkReady: () => new Promise<void>(() => {}),
		});
		const start = Date.now();
		assert.equal((await app.request("/ready")).status, 503);
		assert.ok(Date.now() - start < 3000);
	} finally {
		await f.close();
	}
});

test("structured logs redact credentials and retain request correlation and stack", () => {
	const lines: string[] = [];
	const logger = createLogger("redaction-test", {
		write: (line) => {
			lines.push(line);
		},
	});
	logger.error(
		{
			err: new Error("connection postgres://user:secret-value@host/db failed"),
			requestId: "request-1",
			headers: {
				cookie: "private-cookie",
				authorization: "Bearer private-token",
			},
			password: "private-password",
		},
		"Request failed",
	);
	const output = lines.join("");
	for (const value of [
		"secret-value",
		"private-cookie",
		"private-token",
		"private-password",
	])
		assert.ok(!output.includes(value));
	const entry = JSON.parse(output);
	assert.equal(entry.requestId, "request-1");
	assert.ok(entry.err.stack);
});

test("queue degradation has a separate readiness endpoint and maps job errors to 503", async () => {
	const { ProfileJobsUnavailableError } = await import(
		"@full-stack-example/business/users/jobs/profile-read/producer"
	);
	const f = await fixture();
	try {
		f.deps.services.profileJobs.enqueueProfileRead = async () => {
			throw new ProfileJobsUnavailableError();
		};
		const { app } = createApi({
			...f.deps,
			corsOrigin: "http://localhost:3001",
			checkReady: async () => {},
			checkJobsReady: async () => {
				throw new Error("Redis down");
			},
		});
		assert.equal((await app.request("/ready")).status, 200);
		assert.equal((await app.request("/ready/jobs")).status, 503);
		const result = await app.request("/rpc/users/enqueueProfileRead", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ json: null }),
		});
		assert.equal(result.status, 503);
	} finally {
		await f.close();
	}
});

test("expected RPC rejections use info logs and unknown paths never become labels", async () => {
	const f = await fixture(null);
	const lines: string[] = [];
	try {
		const logger = createLogger("test", {
			write: (line) => {
				lines.push(line);
			},
		});
		const { app } = createApi({
			...f.deps,
			logger,
			corsOrigin: "http://localhost:3001",
			checkReady: async () => {},
		});
		assert.equal(
			(
				await app.request("/rpc/users/me", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ json: null }),
				})
			).status,
			401,
		);
		await app.request("/private-arbitrary-secret-url");
		const entries = lines.map((line) => JSON.parse(line));
		assert.ok(
			entries.some(
				(entry) => entry.event === "rpc.rejected" && entry.level === 30,
			),
		);
		assert.ok(!entries.some((entry) => entry.level >= 50));
		assert.ok(!lines.join("").includes("private-arbitrary-secret-url"));
	} finally {
		await f.close();
	}
});
