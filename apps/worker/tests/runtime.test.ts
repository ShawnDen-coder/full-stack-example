import assert from "node:assert/strict";
import { test } from "node:test";
import {
	startWorker,
	type WorkerConfig,
	type WorkerFactories,
} from "../src/runtime";

const config: WorkerConfig = {
	DATABASE_URL: "postgresql://localhost/unused",
	REDIS_URL: "redis://localhost:6379",
	WORKER_CONCURRENCY: 3,
	WORKER_STARTUP_TIMEOUT_MS: 1000,
};

function fixture() {
	const calls: string[] = [];
	const resources = {
		usersService: { getProfile: async () => null },
		checkReady: async () => {
			calls.push("database.ready");
		},
		close: async () => {
			calls.push("database.close");
		},
	};
	const worker = {
		waitUntilReady: async () => {
			calls.push("worker.ready");
		},
		run: async () => {
			calls.push("worker.run");
		},
		close: async (force = false) => {
			calls.push(force ? "worker.abort" : "worker.drain");
		},
	};
	const factories: WorkerFactories = {
		createResources: () => {
			calls.push("database.create");
			return resources;
		},
		createWorker: (options) => {
			calls.push("worker.create");
			assert.equal(options.autorun, false);
			assert.equal(options.concurrency, config.WORKER_CONCURRENCY);
			assert.equal(options.usersService, resources.usersService);
			return worker;
		},
	};
	return { calls, resources, worker, factories };
}

test("consumption starts only after database and Redis are ready; close drains first and is idempotent", async () => {
	const f = fixture();
	const runtime = await startWorker(config, f.factories);
	assert.deepEqual(f.calls, [
		"database.create",
		"database.ready",
		"worker.create",
		"worker.ready",
		"worker.run",
	]);
	const first = runtime.close();
	assert.equal(runtime.close(), first);
	await first;
	assert.deepEqual(f.calls.slice(-2), ["worker.drain", "database.close"]);
});

test("pending readiness never starts consuming jobs", async () => {
	const f = fixture();
	let ready: () => void = () => {};
	let checking: () => void = () => {};
	const checked = new Promise<void>((resolve) => {
		checking = resolve;
	});
	f.worker.waitUntilReady = () =>
		new Promise<void>((resolve) => {
			ready = resolve;
			checking();
		});
	const startup = startWorker(config, f.factories);
	await checked;
	assert.ok(!f.calls.includes("worker.run"));
	ready();
	const runtime = await startup;
	assert.ok(f.calls.includes("worker.run"));
	await runtime.close();
});

test("a failed database check releases its pool without creating a worker", async () => {
	const f = fixture();
	f.resources.checkReady = async () => {
		throw new Error("database unavailable");
	};
	await assert.rejects(
		() => startWorker(config, f.factories),
		/database unavailable/,
	);
	assert.deepEqual(f.calls, ["database.create", "database.close"]);
});

test("worker construction failure still releases the database", async () => {
	const f = fixture();
	f.factories.createWorker = () => {
		throw new Error("worker creation failed");
	};
	await assert.rejects(
		() => startWorker(config, f.factories),
		/worker creation failed/,
	);
	assert.equal(f.calls.at(-1), "database.close");
});

test("Redis readiness failure force-closes the unstarted worker and database", async () => {
	const f = fixture();
	f.worker.waitUntilReady = async () => {
		throw new Error("redis unavailable");
	};
	await assert.rejects(
		() => startWorker(config, f.factories),
		/redis unavailable/,
	);
	assert.ok(!f.calls.includes("worker.run"));
	assert.deepEqual(f.calls.slice(-2), ["worker.abort", "database.close"]);
});

test("startup has a deadline even while Redis keeps reconnecting", async () => {
	const f = fixture();
	f.worker.waitUntilReady = () => new Promise<void>(() => {});
	await assert.rejects(
		() => startWorker({ ...config, WORKER_STARTUP_TIMEOUT_MS: 1 }, f.factories),
		/startup timed out/,
	);
	assert.deepEqual(f.calls.slice(-2), ["worker.abort", "database.close"]);
});

test("database cleanup still runs if worker draining fails", async () => {
	const f = fixture();
	const runtime = await startWorker(config, f.factories);
	f.worker.close = async () => {
		throw new Error("drain failed");
	};
	await assert.rejects(() => runtime.close(), /drain failed/);
	assert.equal(f.calls.at(-1), "database.close");
});

test("startup errors preserve cleanup errors while attempting all cleanup", async () => {
	const f = fixture();
	f.worker.waitUntilReady = async () => {
		throw new Error("redis unavailable");
	};
	f.worker.close = async () => {
		throw new Error("close failed");
	};
	await assert.rejects(
		() => startWorker(config, f.factories),
		(error: unknown) => {
			assert.ok(error instanceof AggregateError);
			assert.equal(error.errors.length, 2);
			return true;
		},
	);
	assert.equal(f.calls.at(-1), "database.close");
});

test("invalid concurrency and timeout fail before allocating resources", async () => {
	const f = fixture();
	await assert.rejects(
		() => startWorker({ ...config, WORKER_CONCURRENCY: 1.5 }, f.factories),
		/Invalid worker/,
	);
	await assert.rejects(
		() => startWorker({ ...config, WORKER_STARTUP_TIMEOUT_MS: 0 }, f.factories),
		/Invalid worker/,
	);
	assert.deepEqual(f.calls, []);
});

test("a stalled database readiness check times out and releases resources", async () => {
	const f = fixture();
	f.resources.checkReady = () => new Promise<void>(() => {});
	await assert.rejects(
		() => startWorker({ ...config, WORKER_STARTUP_TIMEOUT_MS: 1 }, f.factories),
		/startup timed out/,
	);
	assert.deepEqual(f.calls, ["database.create", "database.close"]);
});
