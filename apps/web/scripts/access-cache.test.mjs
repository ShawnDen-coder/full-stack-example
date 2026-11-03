import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { resetAccessQueries } from "../src/lib/access-cache.ts";

test("access changes clear old data, cancel late responses and keep observers", async () => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	let release;
	const held = new Promise((resolve) => {
		release = resolve;
	});
	let calls = 0;
	const options = {
		queryKey: ["todos", "workspace"],
		queryFn: async () => {
			calls++;
			if (calls === 2) return held;
			return calls === 1 ? "old restricted data" : "current data";
		},
		staleTime: Number.POSITIVE_INFINITY,
	};
	const observer = new QueryObserver(client, options);
	const unsubscribe = observer.subscribe(() => {});
	await observer.refetch();
	const oldRequest = observer.refetch();
	resetAccessQueries(client, false);
	assert.notEqual(client.getQueryData(options.queryKey), "old restricted data");
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(client.getQueryData(options.queryKey), "current data");
	release("late restricted data");
	await oldRequest;
	assert.equal(client.getQueryData(options.queryKey), "current data");
	assert.equal(
		observer.getCurrentQuery(),
		client.getQueryCache().find({ queryKey: options.queryKey }),
	);
	await client.invalidateQueries({ queryKey: options.queryKey });
	assert.equal(calls, 4);
	unsubscribe();
	client.clear();
});

test("workspace list is retained only across unchanged superadmin access", async () => {
	const client = new QueryClient();
	client.setQueryData(["workspaces", "all", 0], "platform data");
	client.setQueryData(["access", "me"], "access data");
	resetAccessQueries(client, true);
	assert.equal(client.getQueryData(["workspaces", "all", 0]), "platform data");
	resetAccessQueries(client, false);
	assert.equal(client.getQueryData(["workspaces", "all", 0]), undefined);
	assert.equal(client.getQueryData(["access", "me"]), "access data");
	client.clear();
});
