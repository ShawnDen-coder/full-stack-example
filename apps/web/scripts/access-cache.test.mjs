import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { resetNonAccessQueries } from "../src/lib/access-cache.ts";

test("access changes clear old data, cancel late responses and keep observers", {
	timeout: 5000,
}, async (t) => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	t.after(() => client.clear());
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
	let refreshed;
	const currentData = new Promise((resolve) => {
		refreshed = resolve;
	});
	const unsubscribe = observer.subscribe((result) => {
		if (result.isSuccess && result.data === "current data") refreshed();
	});
	t.after(unsubscribe);
	await observer.refetch();
	const oldRequest = observer.refetch();
	resetNonAccessQueries(client, { keepWorkspaceList: false });
	assert.notEqual(client.getQueryData(options.queryKey), "old restricted data");
	await currentData;
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
});

test("workspace list is retained only across unchanged superadmin access", async (t) => {
	const client = new QueryClient();
	t.after(() => client.clear());
	client.setQueryData(["workspaces", "all", 0], "platform data");
	client.setQueryData(["access", "me"], "access data");
	resetNonAccessQueries(client, { keepWorkspaceList: true });
	assert.equal(client.getQueryData(["workspaces", "all", 0]), "platform data");
	resetNonAccessQueries(client, { keepWorkspaceList: false });
	assert.equal(client.getQueryData(["workspaces", "all", 0]), undefined);
	assert.equal(client.getQueryData(["access", "me"]), "access data");
});
