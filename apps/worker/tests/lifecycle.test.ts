import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import { createLogger } from "@full-stack-example/observability";
import { startWorkerProcess } from "../src/lifecycle";
import { WorkerStartupAbortedError } from "../src/runtime";

const logger = createLogger("test");
logger.level = "silent";
const config = {
	DATABASE_URL: "postgresql://localhost/unused",
	REDIS_URL: "redis://localhost",
	WORKER_CONCURRENCY: 1,
	WORKER_STARTUP_TIMEOUT_MS: 100,
	WORKER_SHUTDOWN_TIMEOUT_MS: 1000,
};
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("shutdown cancels startup and flushes telemetry; cancellation is a successful exit", async () => {
	const calls: string[] = [];
	const worker = startWorkerProcess({
		config,
		logger,
		start: ({ signal }) =>
			new Promise((_, reject) => {
				signal?.addEventListener(
					"abort",
					() => {
						calls.push("abort");
						reject(new WorkerStartupAbortedError());
					},
					{ once: true },
				);
			}),
		heartbeat: async () => {
			throw new Error("heartbeat must not start");
		},
		telemetry: {
			shutdown: async () => {
				calls.push("telemetry.close");
			},
		},
		exit: (code) => {
			calls.push(`exit.${code}`);
		},
	});
	const closing = worker.shutdown();
	assert.equal(worker.shutdown(), closing);
	await closing;
	await worker.ready;
	assert.deepEqual(calls, ["abort", "telemetry.close", "exit.0"]);
});

test("signal during initial heartbeat removes health before drain and telemetry", async () => {
	const calls: string[] = [];
	const initial = Promise.withResolvers<void>();
	const done = Promise.withResolvers<void>();
	const worker = startWorkerProcess({
		config,
		logger,
		start: async () => ({
			done: done.promise,
			checkReady: async () => {},
			close: async () => {
				calls.push("runtime.close");
				done.resolve();
			},
		}),
		heartbeat: async (_, signal) => {
			signal.addEventListener("abort", () => initial.resolve(), { once: true });
			await initial.promise;
			return {
				close: async () => {
					calls.push("heartbeat.close");
				},
			};
		},
		telemetry: {
			shutdown: async () => {
				calls.push("telemetry.close");
			},
		},
		exit: (code) => {
			calls.push(`exit.${code}`);
		},
	});
	await tick();
	await worker.shutdown();
	await worker.ready;
	assert.ok(calls.indexOf("heartbeat.close") < calls.indexOf("runtime.close"));
	assert.deepEqual(calls.slice(-3), [
		"runtime.close",
		"telemetry.close",
		"exit.0",
	]);
});

test("fatal loop failure drains the process and exits nonzero; cleanup failure still exits", async () => {
	for (const cleanupFails of [false, true]) {
		const done = Promise.withResolvers<void>();
		const exited = Promise.withResolvers<number>();
		let flushes = 0;
		const worker = startWorkerProcess({
			config,
			logger,
			start: async () => ({
				done: done.promise,
				checkReady: async () => {},
				close: async () => {
					if (cleanupFails) throw new Error("close failed");
				},
			}),
			heartbeat: async () => ({ close: async () => {} }),
			telemetry: {
				shutdown: async () => {
					flushes++;
				},
			},
			exit: (code) => exited.resolve(code),
		});
		await worker.ready;
		done.reject(new Error("consumer execution failed"));
		assert.equal(await exited.promise, 1);
		assert.equal(flushes, 1);
	}
});

test("the hard shutdown deadline terminates a child even when a consumer never drains", {
	timeout: 10000,
}, async () => {
	const source = `
import { startWorkerProcess } from ${JSON.stringify(new URL("../src/lifecycle.ts", import.meta.url).href)};
import { createLogger } from '@full-stack-example/observability';
const logger = createLogger('test'); logger.level = 'silent';
const worker = startWorkerProcess({
 config: ${JSON.stringify({ ...config, WORKER_SHUTDOWN_TIMEOUT_MS: 30 })}, logger,
 start: async () => ({ done: new Promise(() => {}), checkReady: async () => {}, close: () => new Promise(() => {}) }),
 heartbeat: async () => ({ close: async () => {} }),
 telemetry: { shutdown: async () => {} }, exit: code => process.exit(code),
});
await worker.ready;
await worker.shutdown();`;
	const child = spawn(
		process.execPath,
		["--import", "tsx", "--input-type=module", "--eval", source],
		{ stdio: "pipe" },
	);
	let errors = "";
	child.stderr.on("data", (chunk) => {
		errors += chunk;
	});
	try {
		const [code, signal] = await once(child, "exit");
		assert.equal(signal, null, errors);
		assert.equal(code, 1, errors);
	} finally {
		if (child.exitCode === null) child.kill("SIGKILL");
	}
});
