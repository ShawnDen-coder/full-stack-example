import assert from "node:assert/strict";
import { test } from "node:test";
import {
	createQueueMonitor,
	QueueMonitorUnavailableError,
	type QueueReadAdapter,
} from "@full-stack-example/api/queue-monitor";
import {
	summarizeProfileJobData,
	summarizeProfileJobResult,
} from "../src/queue-summaries";

type Job = {
	id?: string;
	name: string;
	timestamp: number;
	processedOn?: number;
	finishedOn?: number;
	attemptsMade?: number;
	opts?: { attempts?: number };
	failedReason?: string;
	stacktrace?: string[];
	data: unknown;
	returnvalue: unknown;
	getState: () => Promise<string>;
};

function monitor(
	adapter: QueueReadAdapter,
	queue: {
		getJobLogs: (
			jobId: string,
			start?: number,
			end?: number,
		) => Promise<{ logs: string[]; count: number }>;
	},
) {
	return createQueueMonitor(
		[
			{
				key: "user-profile",
				name: "User profile",
				queue,
				summarizeData: summarizeProfileJobData,
				summarizeResult: summarizeProfileJobResult,
			},
		],
		{ createAdapter: () => adapter },
	);
}

test("unknown queues do not call the adapter", async () => {
	let calls = 0;
	const adapter: QueueReadAdapter = {
		getJobCounts: async () => {
			calls += 1;
			return {};
		},
		isPaused: async () => false,
		getJobs: async () => [],
		getJob: async () => {
			calls += 1;
			return undefined;
		},
		getJobSchedulersCount: async () => 102,
		getJobSchedulers: async () => {
			calls += 1;
			return [];
		},
	};
	const subject = monitor(adapter, {
		getJobLogs: async () => ({ logs: [], count: 0 }),
	});
	assert.equal(
		await subject.jobs({
			queueKey: "other",
			status: "failed",
			page: 1,
			pageSize: 20,
		}),
		null,
	);
	assert.equal(await subject.job({ queueKey: "other", jobId: "1" }), null);
	assert.equal(await subject.schedulers({ queueKey: "other" }), null);
	assert.equal(calls, 0);
});

test("job detail keeps the whitelist summary and redacts failure text", async () => {
	const job: Job = {
		id: "job-1",
		name: "profile",
		timestamp: 10,
		attemptsMade: 2,
		opts: { attempts: 3 },
		failedReason: "boom user@example.com abcdefghijklmnopqrstuvwxyz1234567890",
		stacktrace: [
			"at work user@example.com abcdefghijklmnopqrstuvwxyz1234567890",
		],
		data: { userId: "user-1", requestId: "req-1", token: "secret" },
		returnvalue: { id: "user-1", name: "Ada", emailVerified: true },
		getState: async () => "failed",
	};
	const subject = monitor(
		{
			getJobCounts: async () => ({ failed: 1 }),
			isPaused: async () => false,
			getJobs: async () => [],
			getJob: async () => job,
			getJobSchedulersCount: async () => 102,
			getJobSchedulers: async () => [],
		},
		{ getJobLogs: async () => ({ logs: [], count: 0 }) },
	);
	const detail = await subject.job({
		queueKey: "user-profile",
		jobId: "job-1",
	});
	assert.equal(detail?.failedReason, "boom [redacted-email] [redacted-token]");
	assert.equal(detail?.stacktrace, "at work [redacted-email] [redacted-token]");
	assert.deepEqual(detail?.summary, { userId: "user-1", requestId: "req-1" });
	assert.deepEqual(detail?.result, { id: "user-1", emailVerified: "true" });
	assert.equal(detail?.attemptsMade, 2);
	assert.equal(detail?.attemptsConfigured, 3);
	assert.equal("name" in (detail?.result ?? {}), false);
});

test("logs stay bounded and a missing job does not read logs", async () => {
	const ranges: Array<[number, number]> = [];
	let reads = 0;
	const subject = monitor(
		{
			getJobCounts: async () => ({}),
			isPaused: async () => false,
			getJobs: async () => [],
			getJob: async (id) =>
				id === "job-1"
					? {
							id,
							name: "profile",
							timestamp: 1,
							data: { userId: "user-1" },
							returnvalue: null,
							getState: async () => "completed",
						}
					: undefined,
			getJobSchedulersCount: async () => 102,
			getJobSchedulers: async () => [],
		},
		{
			getJobLogs: async (_id, start = 0, end = 0) => {
				reads += 1;
				ranges.push([start, end]);
				return {
					logs: [`user@example.com ${"x".repeat(2001)}`],
					count: 80,
				};
			},
		},
	);
	const page = await subject.logs({
		queueKey: "user-profile",
		jobId: "job-1",
		page: 2,
		pageSize: 50,
	});
	assert.deepEqual(ranges, [[50, 99]]);
	assert.equal(page?.clipped, true);
	assert.equal(page?.lines[0]?.includes("[redacted-email]"), true);
	assert.equal(page?.lines[0]?.includes("[redacted-token]"), true);
	assert.equal(
		await subject.logs({
			queueKey: "user-profile",
			jobId: "missing",
			page: 1,
			pageSize: 50,
		}),
		null,
	);
	assert.equal(reads, 1);
});

test("redis failures become unavailable and schedulers mark inferred runs", async () => {
	const subject = monitor(
		{
			getJobCounts: async () => {
				throw new Error("redis down");
			},
			isPaused: async () => false,
			getJobs: async () => [],
			getJob: async () => undefined,
			getJobSchedulersCount: async () => 102,
			getJobSchedulers: async (start, end) =>
				[
					{
						id: "nightly",
						name: "profile",
						pattern: "0 0 * * *",
						next: 20,
						lastRun: 10,
					},
					{ id: "idle", name: "profile", every: 1000 },
					...Array.from({ length: 100 }, (_, index) => ({
						id: `extra-${index}`,
						name: "profile",
					})),
				].slice(start, end + 1),
		},
		{ getJobLogs: async () => ({ logs: [], count: 0 }) },
	);
	await assert.rejects(
		() => subject.list(),
		(error: unknown) => error instanceof QueueMonitorUnavailableError,
	);
	const schedulers = await subject.schedulers({ queueKey: "user-profile" });
	assert.equal(schedulers?.total, 102);
	assert.equal(schedulers?.items.length, 50);
	const third = await subject.schedulers({ queueKey: "user-profile", page: 3 });
	assert.equal(third?.items.length, 2);
	assert.deepEqual(schedulers?.items[0]?.lastTrigger, {
		kind: "inferred",
		at: 10,
	});
	assert.deepEqual(schedulers?.items[1]?.lastTrigger, { kind: "unknown" });
	assert.equal(
		schedulers?.items.some((item) => "template" in item),
		false,
	);
});

test("exact lookup matches names and IDs across states without duplicates", async () => {
	const makeJob = (id: string, name: string, state: string): Job => ({
		id,
		name,
		timestamp: 1,
		data: {},
		returnvalue: null,
		getState: async () => state,
	});
	const first = makeJob("profile", "profile", "failed");
	const second = makeJob("2", "profile", "completed");
	const subject = monitor(
		{
			getJobCounts: async () => ({}),
			isPaused: async () => false,
			getJob: async (id) => (id === "profile" ? first : undefined),
			getJobs: async (states) =>
				states[0] === "failed"
					? [first]
					: states[0] === "completed"
						? [second]
						: [],
			getJobSchedulers: async () => [],
			getJobSchedulersCount: async () => 0,
		},
		{ getJobLogs: async () => ({ logs: [], count: 0 }) },
	);
	const result = await subject.jobs({
		queueKey: "user-profile",
		status: "waiting",
		page: 1,
		pageSize: 20,
		jobId: "profile",
	});
	assert.equal(result?.total, 2);
	assert.deepEqual(result?.items.map((item) => item.state).sort(), [
		"completed",
		"failed",
	]);
});

test("exact name search scans beyond the first batch and paginates matches", async () => {
	const jobs = Array.from(
		{ length: 502 },
		(_, index): Job => ({
			id: String(index),
			name: index >= 500 ? "target" : "other",
			timestamp: index,
			data: {},
			returnvalue: null,
			getState: async () => "completed",
		}),
	);
	const ranges: Array<[number, number]> = [];
	const subject = monitor(
		{
			getJobCounts: async () => ({}),
			isPaused: async () => false,
			getJob: async () => undefined,
			getJobs: async (states, start = 0, end = 0) => {
				if (states[0] !== "completed") return [];
				ranges.push([start, end]);
				return jobs.slice(start, end + 1);
			},
			getJobSchedulers: async () => [],
			getJobSchedulersCount: async () => 0,
		},
		{ getJobLogs: async () => ({ logs: [], count: 0 }) },
	);
	const result = await subject.jobs({
		queueKey: "user-profile",
		status: "waiting",
		page: 2,
		pageSize: 1,
		jobId: "target",
	});
	assert.equal(result?.total, 2);
	assert.equal(result?.items[0]?.id, "501");
	assert.deepEqual(ranges, [
		[0, 499],
		[500, 999],
	]);
});
