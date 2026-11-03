import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startHeartbeat } from "../src/heartbeat";

async function publishedTimestamp(file: string) {
	const deadline = performance.now() + 3000;
	for (;;) {
		try {
			return JSON.parse(await readFile(file, "utf8")).timestamp as number;
		} catch (error) {
			if (
				(error as NodeJS.ErrnoException).code !== "ENOENT" ||
				performance.now() >= deadline
			)
				throw error;
			await new Promise<void>((resolve) => setImmediate(resolve));
		}
	}
}

test("worker heartbeat appears only after successful dependency checks and is removed on drain", async () => {
	const directory = await mkdtemp(join(tmpdir(), "worker-heartbeat-"));
	const file = join(directory, "ready.json");
	try {
		const startedAt = Date.now();
		const heartbeat = await startHeartbeat(async () => {}, file);
		try {
			const { timestamp } = JSON.parse(await readFile(file, "utf8"));
			assert.ok(timestamp >= startedAt && timestamp <= Date.now());
		} finally {
			await heartbeat.close();
		}
		await assert.rejects(() => readFile(file), { code: "ENOENT" });
		const failed = await startHeartbeat(async () => {
			throw new Error("unavailable");
		}, file);
		try {
			await assert.rejects(() => readFile(file), { code: "ENOENT" });
		} finally {
			await failed.close();
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("cancelling the initial probe cannot leave a fresh heartbeat", async () => {
	const directory = await mkdtemp(join(tmpdir(), "worker-cancel-"));
	const file = join(directory, "ready.json");
	const controller = new AbortController();
	const probe = Promise.withResolvers<void>();
	try {
		const startup = startHeartbeat(
			() => probe.promise,
			file,
			controller.signal,
		);
		controller.abort();
		probe.resolve();
		const heartbeat = await startup;
		try {
			await assert.rejects(readFile(file), { code: "ENOENT" });
		} finally {
			await heartbeat.close();
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("a timed out check stays in flight until it settles; only a new success restores health", async (t) => {
	t.mock.timers.enable({
		apis: ["setTimeout", "setInterval", "Date"],
		now: Date.now(),
	});
	const directory = await mkdtemp(join(tmpdir(), "worker-pending-"));
	const file = join(directory, "ready.json");
	const late = Promise.withResolvers<void>();
	const started = Promise.withResolvers<void>();
	let heartbeat: Awaited<ReturnType<typeof startHeartbeat>> | undefined;
	let calls = 0;
	try {
		const startup = startHeartbeat(() => {
			calls++;
			started.resolve();
			return calls === 1 ? late.promise : Promise.resolve();
		}, file);
		await started.promise;
		t.mock.timers.tick(2000);
		heartbeat = await startup;
		t.mock.timers.tick(10000);
		assert.equal(calls, 1);
		await assert.rejects(readFile(file), { code: "ENOENT" });
		late.resolve();
		await new Promise<void>((resolve) => setImmediate(resolve));
		await assert.rejects(readFile(file), { code: "ENOENT" });
		t.mock.timers.tick(5000);
		const timestamp = await publishedTimestamp(file);
		assert.equal(calls, 2);
		assert.equal(timestamp, Date.now());
		await heartbeat.close();
		await assert.rejects(readFile(file), { code: "ENOENT" });
	} finally {
		await heartbeat?.close();
		late.resolve();
		await rm(directory, { recursive: true, force: true });
	}
});

test("close does not wait for a permanently hung check or publish a late failure", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
	const directory = await mkdtemp(join(tmpdir(), "worker-close-"));
	const file = join(directory, "ready.json");
	const late = Promise.withResolvers<void>();
	const started = Promise.withResolvers<void>();
	let heartbeat: Awaited<ReturnType<typeof startHeartbeat>> | undefined;
	let calls = 0;
	try {
		const startup = startHeartbeat(() => {
			calls++;
			started.resolve();
			return late.promise;
		}, file);
		await started.promise;
		t.mock.timers.tick(2000);
		heartbeat = await startup;
		await heartbeat.close();
		late.reject(new Error("late"));
		await new Promise<void>((resolve) => setImmediate(resolve));
		assert.equal(calls, 1);
		await assert.rejects(readFile(file), { code: "ENOENT" });
	} finally {
		await heartbeat?.close();
		late.resolve();
		await rm(directory, { recursive: true, force: true });
	}
});
