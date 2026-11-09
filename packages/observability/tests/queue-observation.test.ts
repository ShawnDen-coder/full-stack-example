import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { metrics } from "@opentelemetry/api";
import { observeQueue } from "../src/metrics";

test("stopping queue observation unregisters and waits for the latest collection", async () => {
	const observations: number[] = [];
	let callback:
		| ((result: {
				observe: (_gauge: unknown, value: number) => void;
		  }) => Promise<void>)
		| undefined;
	let removed = false;
	const meter = {
		createObservableGauge: () => ({}),
		addBatchObservableCallback: (fn: typeof callback) => {
			callback = fn;
		},
		removeBatchObservableCallback: (fn: typeof callback) => {
			assert.equal(fn, callback);
			removed = true;
		},
	};
	const stub = mock.method(metrics, "getMeter", () => meter as never);
	const first = Promise.withResolvers<Record<string, number>>();
	const second = Promise.withResolvers<Record<string, number>>();
	let count = 0;
	try {
		const stop = observeQueue(
			{
				getJobCounts: () => (++count === 1 ? first.promise : second.promise),
				getWaiting: async () => [],
			},
			"test",
		);
		assert.ok(callback);
		const result = {
			observe: (_gauge: unknown, value: number) => observations.push(value),
		};
		const a = callback(result);
		const b = callback(result);
		let stopped = false;
		const closing = stop().then(() => {
			stopped = true;
		});
		assert.equal(removed, true);
		await Promise.resolve();
		assert.equal(stopped, false);
		second.resolve({ waiting: 2 });
		await b;
		await closing;
		assert.equal(stopped, true);
		first.reject(new Error("dependency failed"));
		await a;
		assert.deepEqual(observations, [2, 0]);
	} finally {
		stub.mock.restore();
	}
});

test("queue observation timeout emits no fabricated metrics", async () => {
	let callback:
		| ((result: { observe: () => void }) => Promise<void>)
		| undefined;
	let observed = 0;
	const meter = {
		createObservableGauge: () => ({}),
		addBatchObservableCallback: (fn: typeof callback) => {
			callback = fn;
		},
		removeBatchObservableCallback: () => {},
	};
	const stub = mock.method(metrics, "getMeter", () => meter as never);
	const pending = Promise.withResolvers<Record<string, number>>();
	try {
		const stop = observeQueue(
			{ getJobCounts: () => pending.promise, getWaiting: async () => [] },
			"test",
		);
		assert.ok(callback);
		await callback({
			observe: () => {
				observed++;
			},
		});
		assert.equal(observed, 0);
		await stop();
	} finally {
		pending.resolve({});
		stub.mock.restore();
	}
});
