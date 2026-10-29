import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { trackSearchInvalidations } from "../src/features/queues/search-invalidation.ts";

test("search invalidations keep native filters, options, and promise completion", async () => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const ledger = trackSearchInvalidations(client);
	const counts = { active: 0, inactive: 0 };
	let held;
	let release;
	const options = (name) => ({
		queryKey: ["queues", name],
		meta: { explicitQueueSearch: true },
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: async () => {
			counts[name]++;
			if (held) await held;
			return name;
		},
	});
	await client.fetchQuery(options("active"));
	await client.fetchQuery(options("inactive"));
	const observer = new QueryObserver(client, options("active"));
	const unsubscribe = observer.subscribe(() => {});
	await client.invalidateQueries({ queryKey: ["queues"], refetchType: "none" });
	assert.deepEqual(counts, { active: 1, inactive: 1 });
	assert.equal(ledger.has(observer.getCurrentQuery().queryHash), true);
	held = new Promise((resolve) => {
		release = resolve;
	});
	let complete = false;
	const pending = client
		.invalidateQueries(
			{ queryKey: ["queues"], refetchType: "active" },
			{ cancelRefetch: false },
		)
		.then(() => {
			complete = true;
		});
	await Promise.resolve();
	assert.deepEqual(counts, { active: 2, inactive: 1 });
	assert.equal(complete, false);
	release();
	await pending;
	assert.equal(complete, true);
	held = undefined;
	await client.invalidateQueries({
		queryKey: ["queues"],
		refetchType: "inactive",
		predicate: (query) => query.queryKey[1] === "inactive",
	});
	assert.deepEqual(counts, { active: 2, inactive: 2 });
	await client.invalidateQueries({ queryKey: ["queues"], refetchType: "all" });
	assert.deepEqual(counts, { active: 3, inactive: 3 });
	unsubscribe();
	client.clear();
});

test("none during a running fetch survives its old success", async () => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const ledger = trackSearchInvalidations(client);
	let release;
	const held = new Promise((resolve) => {
		release = resolve;
	});
	const options = {
		queryKey: ["queues", "name"],
		meta: { explicitQueueSearch: true },
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: async () => {
			await held;
			return 1;
		},
	};
	const observer = new QueryObserver(client, options);
	const unsubscribe = observer.subscribe(() => {});
	const query = observer.getCurrentQuery();
	await client.invalidateQueries({
		queryKey: options.queryKey,
		refetchType: "none",
	});
	assert.equal(ledger.has(query.queryHash), true);
	release();
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(ledger.has(query.queryHash), true);
	unsubscribe();
	client.clear();
});

test("native refetch joins an existing request and consumes only its intent", async () => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const ledger = trackSearchInvalidations(client);
	let release;
	let calls = 0;
	const held = new Promise((resolve) => {
		release = resolve;
	});
	const options = {
		queryKey: ["queues", "join"],
		meta: { explicitQueueSearch: true },
		retry: false,
		queryFn: async () => {
			calls++;
			await held;
			return "done";
		},
	};
	const observer = new QueryObserver(client, options);
	const unsubscribe = observer.subscribe(() => {});
	const query = observer.getCurrentQuery();
	const pending = client.invalidateQueries(
		{ queryKey: options.queryKey, exact: true },
		{ cancelRefetch: false },
	);
	assert.equal(calls, 1);
	assert.equal(ledger.has(query.queryHash), false);
	release();
	await pending;
	unsubscribe();
	client.clear();
});

test("native throwOnError propagates a selected search failure", async () => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	trackSearchInvalidations(client);
	let calls = 0;
	const options = {
		queryKey: ["queues", "failure"],
		meta: { explicitQueueSearch: true },
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: async () => {
			calls++;
			if (calls > 1) throw new Error("search failed");
			return "cached";
		},
	};
	await client.fetchQuery(options);
	await assert.rejects(
		client.invalidateQueries(
			{ queryKey: options.queryKey, refetchType: "all" },
			{ throwOnError: true },
		),
		/search failed/,
	);
	assert.equal(calls, 2);
	client.clear();
});

test("stale false filter is re-evaluated by native refetch after invalidation", async () => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const ledger = trackSearchInvalidations(client);
	let calls = 0;
	const options = {
		queryKey: ["queues", "fresh"],
		meta: { explicitQueueSearch: true },
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: async () => ++calls,
	};
	await client.fetchQuery(options);
	const observer = new QueryObserver(client, options);
	const unsubscribe = observer.subscribe(() => {});
	const query = observer.getCurrentQuery();
	await client.invalidateQueries({ queryKey: options.queryKey, stale: false });
	assert.equal(calls, 1);
	assert.equal(ledger.has(query.queryHash), true);
	unsubscribe();
	client.clear();
	assert.equal(ledger.has(query.queryHash), false);
});
