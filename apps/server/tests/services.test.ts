import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createLogger } from "@full-stack-example/observability";
import { createServices, type ServerConfig } from "../src/services";

const config: ServerConfig = {
	DATABASE_URL: "postgresql://unused/unused",
	REDIS_URL: "redis://unused",
	BETTER_AUTH_SECRET: "test-only-secret-at-least-32-characters",
	BETTER_AUTH_URL: "http://localhost:3000",
	CORS_ORIGIN: "http://localhost:3001",
	SERVER_SHUTDOWN_TIMEOUT_MS: 50,
};
type Factories = NonNullable<Parameters<typeof createServices>[2]>;
type Failure = "sync" | "async" | "none";

function fixture(
	dbFailure: Failure = "none",
	producerFailure: Failure = "none",
) {
	const calls: string[] = [];
	const cleanupErrors: string[] = [];
	const logger = createLogger("test");
	logger.level = "silent";
	mock.method(logger, "error", (details: unknown) => {
		if (details && typeof details === "object" && "resource" in details)
			cleanupErrors.push(String(details.resource ?? "timeout"));
	});
	const close = (resource: string, failure: Failure) => () => {
		calls.push(resource);
		if (failure === "sync") throw new Error(`${resource} synchronous failure`);
		if (failure === "async")
			return Promise.reject(new Error(`${resource} asynchronous failure`));
		return Promise.resolve();
	};
	const db = {
		close: close("database", dbFailure),
		$client: { query: async () => ({}) },
	} as unknown as ReturnType<NonNullable<Factories["createDb"]>>;
	const producer = {
		close: close("producer", producerFailure),
		getQueueForMonitoring: () => ({}),
		checkReady: async () => {},
	} as unknown as ReturnType<NonNullable<Factories["createProfileReadClient"]>>;
	const auth = {
		api: { getSession: async () => null },
	} as unknown as ReturnType<NonNullable<Factories["createAuth"]>>;
	const factories: Factories = {
		createDb: () => db,
		createAuth: () => auth,
		createProfileReadClient: () => producer,
		createQueueMonitor: () =>
			({}) as ReturnType<NonNullable<Factories["createQueueMonitor"]>>,
	};
	return { calls, cleanupErrors, logger, factories, producer };
}

for (const stage of [
	"createAuth",
	"createProfileReadClient",
	"createUsersService",
	"createTodosService",
	"createQueueMonitor",
	"createAccessService",
] as const) {
	test(`assembly failure at ${stage} rolls back acquired resources`, async () => {
		const f = fixture();
		const original = new Error(`failed ${stage}`);
		f.factories[stage] = () => {
			throw original;
		};
		await assert.rejects(
			createServices(config, f.logger, f.factories),
			(error) => error === original,
		);
		assert.deepEqual(
			f.calls.sort(),
			stage === "createAuth" || stage === "createProfileReadClient"
				? ["database"]
				: ["database", "producer"],
		);
	});
}

for (const [dbFailure, producerFailure] of [
	["sync", "none"],
	["async", "none"],
	["none", "sync"],
	["none", "async"],
	["sync", "async"],
	["async", "sync"],
] as const) {
	test(`rollback isolates database ${dbFailure} and producer ${producerFailure}`, async () => {
		const f = fixture(dbFailure, producerFailure);
		const original = new Error("assembly failed");
		f.factories.createUsersService = () => {
			throw original;
		};
		await assert.rejects(
			createServices(config, f.logger, f.factories),
			(error) => error === original,
		);
		assert.deepEqual(f.calls.sort(), ["database", "producer"]);
		assert.deepEqual(
			f.cleanupErrors.sort(),
			[
				...(dbFailure === "none" ? [] : ["database"]),
				...(producerFailure === "none" ? [] : ["producer"]),
			].sort(),
		);
	});
}

test("hanging producer cleanup is bounded, database is attempted, late rejection handled", async () => {
	const f = fixture();
	const pending = Promise.withResolvers<void>();
	f.producer.close = () => {
		f.calls.push("producer");
		return pending.promise;
	};
	const original = new Error("assembly failed");
	f.factories.createUsersService = () => {
		throw original;
	};
	const unhandled: unknown[] = [];
	const listener = (error: unknown) => unhandled.push(error);
	process.on("unhandledRejection", listener);
	try {
		const start = Date.now();
		await assert.rejects(
			createServices(config, f.logger, f.factories),
			(error) => error === original,
		);
		assert.ok(Date.now() - start < 1000);
		assert.deepEqual(f.calls.sort(), ["database", "producer"]);
		pending.reject(new Error("late close failure"));
		await new Promise<void>((resolve) => setImmediate(resolve));
		assert.deepEqual(unhandled, []);
		assert.deepEqual(f.cleanupErrors, ["timeout", "producer"]);
	} finally {
		process.off("unhandledRejection", listener);
	}
});

test("assembly rejection waits for acquired resources to finish closing", async () => {
	const f = fixture();
	const pending = Promise.withResolvers<void>();
	f.producer.close = () => {
		f.calls.push("producer");
		return pending.promise;
	};
	const original = new Error("assembly failed");
	f.factories.createUsersService = () => {
		throw original;
	};
	let finished = false;
	const startup = createServices(
		{ ...config, SERVER_SHUTDOWN_TIMEOUT_MS: 1000 },
		f.logger,
		f.factories,
	).catch((error: unknown) => {
		finished = true;
		throw error;
	});
	await new Promise<void>((resolve) => setImmediate(resolve));
	assert.equal(finished, false);
	assert.ok(f.calls.includes("database"));
	pending.resolve();
	await assert.rejects(startup, (error) => error === original);
});

test("successful close is idempotent and closes producer before database", async () => {
	const f = fixture();
	const runtime = await createServices(config, f.logger, f.factories);
	const first = runtime.close();
	assert.equal(runtime.close(), first);
	await first;
	assert.deepEqual(f.calls, ["producer", "database"]);
});
