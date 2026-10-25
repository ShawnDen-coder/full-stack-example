import assert from "node:assert/strict";
import { test } from "node:test";
import { createLogger } from "@full-stack-example/observability";
import {
	type Consumer,
	startWorker,
	type WorkerConfig,
	type WorkerFactories,
	WorkerStartupAbortedError,
} from "../src/runtime";

const config: WorkerConfig = {
	DATABASE_URL: "postgresql://localhost/unused",
	REDIS_URL: "redis://localhost:6379",
	WORKER_CONCURRENCY: 3,
	WORKER_STARTUP_TIMEOUT_MS: 1000,
	WORKER_SHUTDOWN_TIMEOUT_MS: 1000,
};
const logger = createLogger("test");
logger.level = "silent";
function at<T>(items: readonly T[], index: number): T {
	const item = items[index];
	assert.ok(item);
	return item;
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture(count = 2) {
	const calls: string[] = [];
	const resources = {
		services: { usersService: { getProfile: async () => null } },
		checkReady: async () => {
			calls.push("database.ready");
		},
		close: async () => {
			calls.push("database.close");
		},
	};
	const loops = Array.from({ length: count }, () =>
		Promise.withResolvers<void>(),
	);
	const workers: Consumer[] = loops.map((loop, i) => ({
		waitUntilReady: async () => {
			calls.push(`${i}.ready`);
		},
		run: () => {
			calls.push(`${i}.run`);
			return loop.promise;
		},
		isRunning: () => true,
		client: Promise.resolve({
			status: "ready",
			get: async () => {
				calls.push(`${i}.probe`);
				return null;
			},
		}),
		close: async (force = false) => {
			calls.push(`${i}.${force ? "abort" : "drain"}`);
			loop.resolve();
		},
	}));
	const factories: WorkerFactories = {
		createResources: () => {
			calls.push("database.create");
			return resources;
		},
		consumerDefinitions: workers.map((worker, i) => ({
			name: `consumer-${i}`,
			create: (options) => {
				calls.push(`${i}.create`);
				assert.equal(options.concurrency, config.WORKER_CONCURRENCY);
				assert.equal(options.services, resources.services);
				return worker;
			},
		})),
	};
	const start = (overrides: Partial<WorkerConfig> = {}, signal?: AbortSignal) =>
		startWorker({
			config: { ...config, ...overrides },
			factories,
			logger,
			signal,
		});
	return { calls, resources, workers, loops, factories, start };
}

test("one and two consumers share a readiness barrier and idempotent drain", async () => {
	for (const count of [1, 2]) {
		const f = fixture(count);
		const pending = Promise.withResolvers<void>();
		at(f.workers, count - 1).waitUntilReady = () => pending.promise;
		const startup = f.start();
		await tick();
		assert.ok(!f.calls.some((call) => call.endsWith(".run")));
		pending.resolve();
		const runtime = await startup;
		await runtime.checkReady();
		assert.equal(f.calls.filter((call) => call === "database.ready").length, 2);
		assert.equal(
			f.calls.filter((call) => call.endsWith(".probe")).length,
			count,
		);
		const first = runtime.close();
		assert.equal(runtime.close(), first);
		await first;
		await runtime.done;
		assert.equal(f.calls.at(-1), "database.close");
		await assert.rejects(runtime.checkReady, /not running/);
	}
});

test("configuration and registry errors fail before any resource allocation", async () => {
	for (const override of [
		{ WORKER_CONCURRENCY: 1.5 },
		{ WORKER_STARTUP_TIMEOUT_MS: 0 },
		{ WORKER_SHUTDOWN_TIMEOUT_MS: -1 },
		{ DATABASE_URL: "postgresql://" },
		{ REDIS_URL: "https://localhost" },
	]) {
		const f = fixture();
		await assert.rejects(f.start(override), /Invalid worker/);
		assert.deepEqual(f.calls, []);
	}
	for (const definitions of [
		[],
		[{ name: "same" }, { name: "same" }],
		[{ name: "user-id!" }],
		[{ name: "valid", concurrency: 101 }],
	]) {
		const f = fixture();
		f.factories.consumerDefinitions = definitions.map((definition) => ({
			...definition,
			create: () => at(f.workers, 0),
		}));
		await assert.rejects(f.start());
		assert.deepEqual(f.calls, []);
	}
});

test("per-consumer concurrency overrides the default", async () => {
	const f = fixture(1);
	f.factories.consumerDefinitions = [
		{
			name: "custom",
			concurrency: 7,
			create: ({ concurrency }) => {
				assert.equal(concurrency, 7);
				return at(f.workers, 0);
			},
		},
	];
	await (await f.start()).close();
});

test("database failure or deadline never constructs consumers", async () => {
	for (const hang of [false, true]) {
		const f = fixture();
		f.resources.checkReady = () =>
			hang
				? new Promise(() => {})
				: Promise.reject(new Error("database unavailable"));
		await assert.rejects(
			f.start({ WORKER_STARTUP_TIMEOUT_MS: 10 }),
			/database unavailable|startup timed out/,
		);
		assert.deepEqual(f.calls, ["database.create", "database.close"]);
	}
});

test("partial construction failure aborts the first consumer and releases shared resources", async () => {
	const f = fixture();
	f.factories.consumerDefinitions = [
		at(f.factories.consumerDefinitions, 0),
		{
			name: "broken",
			create: () => {
				throw new Error("construction failed");
			},
		},
	];
	await assert.rejects(f.start(), /construction failed/);
	assert.deepEqual(f.calls.slice(-2), ["0.abort", "database.close"]);
	assert.ok(!f.calls.some((call) => call.endsWith(".run")));
});

test("Redis failure and timeout clean up every returned handle without consuming", async () => {
	for (const hang of [false, true]) {
		const f = fixture();
		at(f.workers, 1).waitUntilReady = () =>
			hang
				? new Promise(() => {})
				: Promise.reject(new Error("redis unavailable"));
		await assert.rejects(
			f.start({ WORKER_STARTUP_TIMEOUT_MS: 10 }),
			/redis unavailable|startup timed out/,
		);
		assert.ok(f.calls.includes("0.abort") && f.calls.includes("1.abort"));
		assert.equal(f.calls.at(-1), "database.close");
		assert.ok(!f.calls.some((call) => call.endsWith(".run")));
	}
});

test("startup rollback preserves cleanup failures and attempts all consumers", async () => {
	const f = fixture();
	at(f.workers, 1).waitUntilReady = async () => {
		throw new Error("redis unavailable");
	};
	at(f.workers, 0).close = () => {
		throw new Error("sync close failure");
	};
	await assert.rejects(f.start(), (error: unknown) => {
		assert.ok(error instanceof AggregateError);
		assert.match(String(error.errors[0]), /redis unavailable/);
		assert.match(String(error.errors[1]), /consumer-0/);
		return true;
	});
	assert.ok(f.calls.includes("1.abort"));
	assert.equal(f.calls.at(-1), "database.close");
});

test("startup rollback itself has one bounded deadline", async () => {
	const f = fixture();
	at(f.workers, 1).waitUntilReady = async () => {
		throw new Error("redis unavailable");
	};
	at(f.workers, 0).close = () => new Promise(() => {});
	await assert.rejects(
		f.start({ WORKER_SHUTDOWN_TIMEOUT_MS: 10 }),
		(error: unknown) => {
			assert.ok(error instanceof AggregateError);
			assert.match(String(error.errors[1]), /cleanup timed out/);
			return true;
		},
	);
	assert.ok(f.calls.includes("1.abort"));
});

test("abort before startup, during database/Redis wait and between factory/run calls rolls back", async () => {
	for (const phase of ["before", "database", "redis", "create", "run"]) {
		const f = fixture();
		const controller = new AbortController();
		if (phase === "before") controller.abort();
		if (phase === "database")
			f.resources.checkReady = async () => {
				controller.abort();
				await new Promise(() => {});
			};
		if (phase === "redis")
			at(f.workers, 0).waitUntilReady = async () => {
				controller.abort();
				await new Promise(() => {});
			};
		if (phase === "create")
			f.factories.consumerDefinitions = [
				{
					name: "cancel",
					create: () => {
						controller.abort();
						return at(f.workers, 0);
					},
				},
			];
		if (phase === "run")
			at(f.workers, 0).run = () => {
				controller.abort();
				return at(f.loops, 0).promise;
			};
		await assert.rejects(
			f.start({}, controller.signal),
			WorkerStartupAbortedError,
		);
		if (phase === "before") assert.deepEqual(f.calls, []);
		else assert.equal(f.calls.at(-1), "database.close");
	}
});

test("loop rejection or unexpected resolution is fatal and immediately invalidates readiness", async () => {
	for (const rejects of [true, false]) {
		const f = fixture();
		const runtime = await f.start();
		if (rejects) at(f.loops, 1).reject(new Error("loop failed"));
		else at(f.loops, 1).resolve();
		await assert.rejects(runtime.done, /consumer-1/);
		await assert.rejects(runtime.checkReady, /not running/);
		await assert.rejects(runtime.close(), AggregateError);
		assert.equal(f.calls.at(-1), "database.close");
	}
});

test("simultaneous failures are observed immediately and retained on close", async () => {
	const f = fixture();
	const runtime = await f.start();
	at(f.loops, 0).reject(new Error("first"));
	at(f.loops, 1).reject(new Error("second"));
	await tick(); // Intentionally subscribe late; node:test catches unhandled rejections.
	await assert.rejects(runtime.done, /consumer-0/);
	await assert.rejects(runtime.close(), (error: unknown) => {
		assert.ok(error instanceof AggregateError);
		assert.equal(error.errors.length, 2);
		assert.match(String(error.errors[1]), /consumer-1/);
		return true;
	});
});

test("all consumers drain concurrently and shared database stays open until the last finishes", async () => {
	const f = fixture();
	const drain = Promise.withResolvers<void>();
	at(f.workers, 0).close = async () => {
		f.calls.push("0.drain");
		await drain.promise;
		at(f.loops, 0).resolve();
	};
	const runtime = await f.start();
	const closing = runtime.close();
	await tick();
	assert.ok(f.calls.includes("1.drain"));
	assert.ok(!f.calls.includes("database.close"));
	drain.resolve();
	await closing;
	assert.equal(f.calls.filter((call) => call === "database.close").length, 1);
});

test("failed or stalled drain never releases the database beneath potentially active jobs", async () => {
	for (const hangs of [false, true]) {
		const f = fixture();
		at(f.workers, 0).close = () =>
			hangs ? new Promise(() => {}) : Promise.reject(new Error("drain failed"));
		const runtime = await f.start({ WORKER_SHUTDOWN_TIMEOUT_MS: 10 });
		await assert.rejects(runtime.close(), /drain failed|shutdown timed out/);
		await assert.rejects(runtime.done);
		assert.ok(f.calls.includes("1.drain"));
		assert.ok(!f.calls.includes("database.close"));
	}
});

test("loop errors during drain are failures, while expected loop completion is allowed", async () => {
	const f = fixture();
	at(f.workers, 0).close = async () => {
		at(f.loops, 0).reject(new Error("late failure"));
	};
	const runtime = await f.start();
	await assert.rejects(runtime.close(), AggregateError);
	await assert.rejects(runtime.done, /consumer-0/);
	assert.equal(f.calls.at(-1), "database.close");
});

test("each consumer must be consuming and connected for aggregate readiness", async () => {
	const f = fixture();
	const runtime = await f.start();
	at(f.workers, 1).isRunning = () => false;
	await assert.rejects(runtime.checkReady, /consumer-1/);
	at(f.workers, 1).isRunning = () => true;
	Object.assign(await at(f.workers, 1).client, { status: "reconnecting" });
	await assert.rejects(runtime.checkReady, /consumer-1/);
	await runtime.close();
});
