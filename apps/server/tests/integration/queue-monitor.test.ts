import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createQueueMonitor } from "@full-stack-example/api/queue-monitor";
import { createQueueConnection, Queue } from "@full-stack-example/queue";

test("native queue monitoring reads lists, details, logs and schedulers from Redis", async () => {
	const redisUrl = process.env.TEST_REDIS_URL;
	if (!redisUrl) throw new Error("Dedicated TEST_REDIS_URL required");
	const queue = new Queue<{ userId: string }, { ok: boolean }, "profile">(
		`monitor-test-${randomUUID()}`,
		{ connection: createQueueConnection(redisUrl) },
	);
	queue.on("error", () => {});
	try {
		const job = await queue.add("profile", { userId: "test-user" });
		assert.ok(job.id);
		await job.log("email user@example.com");
		await queue.upsertJobScheduler(
			"profile",
			{ every: 60000 },
			{ name: "profile", data: { userId: "test-user" } },
		);
		const monitor = createQueueMonitor([
			{
				key: "profile",
				name: "Profile",
				queue,
				summarizeData: (data) => ({
					userId: (data as { userId: string }).userId,
				}),
				summarizeResult: () => ({}),
			},
		]);
		assert.equal((await monitor.list())[0]?.key, "profile");
		const list = await monitor.jobs({
			queueKey: "profile",
			status: "waiting",
			page: 1,
			pageSize: 20,
		});
		assert.ok(list?.items.some((item) => item.id === job.id));
		assert.equal(
			(await monitor.job({ queueKey: "profile", jobId: job.id }))?.summary
				.userId,
			"test-user",
		);
		assert.deepEqual(
			(
				await monitor.logs({
					queueKey: "profile",
					jobId: job.id,
					page: 1,
					pageSize: 20,
				})
			)?.lines,
			["email [redacted-email]"],
		);
		assert.equal(
			(await monitor.schedulers({ queueKey: "profile" }))?.items[0]?.id,
			"profile",
		);
		assert.equal(
			await monitor.logs({
				queueKey: "profile",
				jobId: "missing",
				page: 1,
				pageSize: 20,
			}),
			null,
		);
	} finally {
		await queue.obliterate({ force: true });
		await queue.close();
	}
});
