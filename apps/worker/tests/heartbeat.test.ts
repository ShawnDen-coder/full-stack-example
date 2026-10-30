import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startHeartbeat } from "../src/heartbeat";

test("worker heartbeat appears only after successful dependency checks and is removed on drain", async () => {
	const directory = await mkdtemp(join(tmpdir(), "worker-heartbeat-"));
	const file = join(directory, "ready.json");
	try {
		const heartbeat = await startHeartbeat(async () => {}, file);
		try {
			const { timestamp } = JSON.parse(await readFile(file, "utf8"));
			assert.ok(Date.now() - timestamp < 1000);
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
		await assert.rejects(readFile(file), { code: "ENOENT" });
		await heartbeat.close();
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("a timed out check stays in flight until it settles; only a new success restores health", async () => {
	const directory = await mkdtemp(join(tmpdir(), "worker-pending-"));
	const file = join(directory, "ready.json");
	const late = Promise.withResolvers<void>();
	let calls = 0;
	const delay = (ms: number) =>
		new Promise((resolve) => setTimeout(resolve, ms));
	try {
		const heartbeat = await startHeartbeat(() => {
			calls++;
			return calls === 1 ? late.promise : Promise.resolve();
		}, file);
		await delay(10200);
		assert.equal(calls, 1);
		await assert.rejects(readFile(file), { code: "ENOENT" });
		late.resolve();
		await delay(100);
		await assert.rejects(readFile(file), { code: "ENOENT" });
		await delay(5000);
		assert.ok(calls >= 2);
		await readFile(file);
		await heartbeat.close();
		await assert.rejects(readFile(file), { code: "ENOENT" });
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("close does not wait for a permanently hung check or publish a late failure", async () => {
	const directory = await mkdtemp(join(tmpdir(), "worker-close-"));
	const file = join(directory, "ready.json");
	const late = Promise.withResolvers<void>();
	let calls = 0;
	try {
		const heartbeat = await startHeartbeat(() => {
			calls++;
			return late.promise;
		}, file);
		await heartbeat.close();
		late.reject(new Error("late"));
		await new Promise((resolve) => setTimeout(resolve, 50));
		assert.equal(calls, 1);
		await assert.rejects(readFile(file), { code: "ENOENT" });
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
