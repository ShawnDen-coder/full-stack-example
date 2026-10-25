import assert from "node:assert/strict";
import { test } from "node:test";
import { createProfileReadProcessor } from "../src/users/jobs/profile-read.processor";
import { getProfileReadJob } from "../src/users/jobs/profile-read.status";

const profile = {
	id: "user-1",
	name: "Alice",
	email: "alice@example.test",
	emailVerified: true,
	image: null,
	createdAt: new Date(),
};
test("job ownership prevents returning another user's result", async () => {
	let stateRead = false;
	const reader = {
		getJob: async () => ({
			id: "job-1",
			data: { userId: "user-1" },
			returnvalue: { id: "user-1", name: "Alice", emailVerified: true },
			getState: async () => {
				stateRead = true;
				return "completed";
			},
		}),
	};
	assert.equal(await getProfileReadJob(reader, "job-1", "user-2"), null);
	assert.equal(stateRead, false);
	assert.equal(
		(await getProfileReadJob(reader, "job-1", "user-1"))?.result?.name,
		"Alice",
	);
	assert.equal(
		await getProfileReadJob(
			{ getJob: async () => undefined },
			"missing",
			"user-1",
		),
		null,
	);
});

test("completion reloads the result when a worker finishes between reads", async () => {
	let reads = 0;
	const profile = { id: "user-1", name: "Alice", emailVerified: true };
	const result = await getProfileReadJob(
		{
			getJob: async () => ({
				id: "job-1",
				data: { userId: "user-1" },
				returnvalue: ++reads === 1 ? null : profile,
				getState: async () => "completed",
			}),
		},
		"job-1",
		"user-1",
	);
	assert.equal(result?.state, "completed");
	assert.deepEqual(result?.result, profile);
});

test("unfinished jobs hide stored results", async () => {
	const result = await getProfileReadJob(
		{
			getJob: async () => ({
				id: "job-1",
				data: { userId: "user-1" },
				returnvalue: { id: "user-1", name: "Alice", emailVerified: true },
				getState: async () => "active",
			}),
		},
		"job-1",
		"user-1",
	);
	assert.equal(result?.result, null);
});

test("worker validates payloads and returns only the intended profile fields", async () => {
	const process = createProfileReadProcessor({
		usersService: { getProfile: async () => profile },
	});
	assert.deepEqual(await process({ userId: "user-1" }), {
		id: "user-1",
		name: "Alice",
		emailVerified: true,
	});
	await assert.rejects(() => process({ userId: "" }));
	const missing = createProfileReadProcessor({
		usersService: { getProfile: async () => null },
	});
	assert.equal(await missing({ userId: "deleted" }), null);
});
