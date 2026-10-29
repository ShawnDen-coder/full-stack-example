import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import type { Queue } from "bullmq";

export const jobStatuses = [
	"waiting",
	"active",
	"delayed",
	"completed",
	"failed",
	"prioritized",
	"waiting-children",
] as const;
export type JobStatus = (typeof jobStatuses)[number];

const TEXT_LIMIT = 2000;

export class QueueMonitorUnavailableError extends Error {
	constructor() {
		super("Queue monitoring is temporarily unavailable");
		this.name = "QueueMonitorUnavailableError";
	}
}

export type MonitoringQueue = {
	getJobLogs(
		jobId: string,
		start?: number,
		end?: number,
		asc?: boolean,
	): Promise<{ logs: string[]; count: number }>;
};

export type QueueMonitorRegistration = {
	key: string;
	name: string;
	queue: MonitoringQueue;
	summarizeData: (data: unknown) => Record<string, string>;
	summarizeResult: (result: unknown) => Record<string, string>;
};

type MonitoredJob = {
	id?: string;
	name: string;
	timestamp: number;
	processedOn?: number;
	finishedOn?: number;
	attemptsMade?: number;
	opts?: { attempts?: number };
	failedReason?: string;
	stacktrace?: string[] | null;
	data: unknown;
	returnvalue: unknown;
	getState(): Promise<string>;
};

type MonitoredScheduler = {
	id: string;
	name?: string;
	pattern?: string | null;
	every?: number | null;
	tz?: string | null;
	next?: number | null;
	lastRun?: number;
};

export type QueueReadAdapter = {
	getJobCounts(): Promise<Record<string, number>>;
	isPaused(): Promise<boolean>;
	getJobs(
		statuses: string[],
		start?: number,
		end?: number,
	): Promise<MonitoredJob[]>;
	getJob(id: string): Promise<MonitoredJob | undefined>;
	getJobSchedulers(start: number, end: number): Promise<MonitoredScheduler[]>;
	getJobSchedulersCount(): Promise<number>;
};

type MonitorOptions = {
	createAdapter?: (queue: MonitoringQueue) => QueueReadAdapter;
};

function clip(value: unknown): string | null {
	if (value == null || value === "") return null;
	const text = String(value)
		.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
		.replace(/[A-Za-z0-9_+/=-]{32,}/g, "[redacted-token]");
	return text.length <= TEXT_LIMIT ? text : `${text.slice(0, TEXT_LIMIT)}…`;
}

function fields(record: Record<string, string>) {
	const summary: Record<string, string> = {};
	for (const [key, value] of Object.entries(record)) {
		const clipped = clip(value);
		if (clipped) summary[key] = clipped;
	}
	return summary;
}

function createBullReader(queue: MonitoringQueue): QueueReadAdapter {
	const adapter = new BullMQAdapter(queue as Queue);
	return {
		getJobCounts: async () => ({ ...(await adapter.getJobCounts()) }),
		isPaused: () => adapter.isPaused(),
		getJobs: (statuses, start, end) =>
			adapter.getJobs(statuses as JobStatus[], start, end),
		getJob: (id) => adapter.getJob(id),
		getJobSchedulersCount: () => (queue as Queue).getJobSchedulersCount(),
		getJobSchedulers: async (start, end) => {
			const rows = await (queue as Queue).getJobSchedulers(start, end);
			return Promise.all(
				rows.map(async (row) => ({
					id: row.key,
					name: row.name,
					pattern: row.pattern ?? null,
					every: row.every ?? null,
					tz: row.tz ?? null,
					next: row.next ?? null,
					lastRun:
						row.next && (row.iterationCount ?? 0) > 1
							? (await (queue as Queue).getJob(`repeat:${row.key}:${row.next}`))
									?.timestamp
							: undefined,
				})),
			);
		},
	};
}

async function read<T>(work: () => Promise<T>) {
	try {
		return await work();
	} catch (error) {
		if (error instanceof QueueMonitorUnavailableError) throw error;
		throw new QueueMonitorUnavailableError();
	}
}

export function createQueueMonitor(
	registrations: QueueMonitorRegistration[],
	options: MonitorOptions = {},
) {
	const createAdapter = options.createAdapter ?? createBullReader;
	const entries = new Map(
		registrations.map((registration) => [
			registration.key,
			{ registration, adapter: createAdapter(registration.queue) },
		]),
	);

	function requireQueue(queueKey: string) {
		return entries.get(queueKey) ?? null;
	}

	function project(
		registration: QueueMonitorRegistration,
		job: MonitoredJob,
		state: string,
	) {
		if (!job.id) return null;
		return {
			id: job.id,
			name: job.name,
			state,
			attemptsMade: job.attemptsMade ?? 0,
			attemptsConfigured:
				typeof job.opts?.attempts === "number" ? job.opts.attempts : null,
			timestamp: job.timestamp,
			processedOn: job.processedOn ?? null,
			finishedOn: job.finishedOn ?? null,
			failedReason: clip(job.failedReason),
			summary: fields(registration.summarizeData(job.data)),
		};
	}

	return {
		async list() {
			const refreshedAt = new Date().toISOString();
			return read(async () => {
				const queues = [];
				for (const { registration, adapter } of entries.values()) {
					const [rawCounts, paused] = await Promise.all([
						adapter.getJobCounts(),
						adapter.isPaused(),
					]);
					const counts = Object.fromEntries(
						jobStatuses.map((status) => [status, rawCounts[status] ?? 0]),
					) as Record<JobStatus, number>;
					queues.push({
						key: registration.key,
						name: registration.name,
						paused,
						counts,
						refreshedAt,
					});
				}
				return queues;
			});
		},
		async jobs({
			queueKey,
			status,
			page,
			pageSize,
			jobId,
			mode = jobId ? "id" : "browse",
			query,
		}: {
			queueKey: string;
			status: JobStatus;
			page: number;
			pageSize: number;
			jobId?: string;
			mode?: "browse" | "id" | "name";
			query?: string;
		}) {
			const entry = requireQueue(queueKey);
			if (!entry) return null;
			return read(async () => {
				const refreshedAt = new Date().toISOString();
				if (mode === "id") {
					const job = await entry.adapter.getJob(query ?? jobId ?? "");
					const item = job?.id
						? project(entry.registration, job, await job.getState())
						: null;
					return {
						mode,
						items: item ? [item] : [],
						total: item ? 1 : 0,
						page: 1,
						pageSize,
						refreshedAt,
					};
				}
				if (mode === "name") {
					const matches = new Map<string, ReturnType<typeof project>>();
					let scannedCount = 0;
					let scanTruncated = false;
					let resultsTruncated = false;
					const seen = new Set<string>();
					for (const state of jobStatuses) {
						const batch = await entry.adapter.getJobs([state], 0, 100);
						if (batch.length > 100) scanTruncated = true;
						for (const job of batch.slice(0, 100)) {
							scannedCount++;
							if (!job.id || job.name !== query || seen.has(job.id)) continue;
							seen.add(job.id);
							if (matches.size >= 50) {
								resultsTruncated = true;
								continue;
							}
							matches.set(job.id, project(entry.registration, job, state));
						}
					}
					return {
						mode,
						items: [...matches.values()].filter((item) => item !== null),
						scannedCount,
						scanTruncated,
						resultsTruncated,
						refreshedAt,
					};
				}
				const rawCounts = await entry.adapter.getJobCounts();
				const start = (page - 1) * pageSize;
				const jobs = await entry.adapter.getJobs(
					[status],
					start,
					start + pageSize - 1,
				);
				return {
					mode: "browse" as const,
					items: jobs.flatMap((job) => {
						const item = project(entry.registration, job, status);
						return item ? [item] : [];
					}),
					total: rawCounts[status] ?? 0,
					page,
					pageSize,
					refreshedAt,
				};
			});
		},
		async job({ queueKey, jobId }: { queueKey: string; jobId: string }) {
			const entry = requireQueue(queueKey);
			if (!entry) return null;
			return read(async () => {
				const job = await entry.adapter.getJob(jobId);
				if (!job?.id) return null;
				const listed = project(entry.registration, job, await job.getState());
				if (!listed) return null;
				const stack = job.stacktrace?.filter(Boolean).join("\n");
				return {
					...listed,
					stacktrace: clip(stack),
					result: fields(entry.registration.summarizeResult(job.returnvalue)),
					refreshedAt: new Date().toISOString(),
				};
			});
		},
		async logs({
			queueKey,
			jobId,
			page,
			pageSize,
		}: {
			queueKey: string;
			jobId: string;
			page: number;
			pageSize: number;
		}) {
			const entry = requireQueue(queueKey);
			if (!entry) return null;
			return read(async () => {
				const job = await entry.adapter.getJob(jobId);
				if (!job?.id) return null;
				const start = (page - 1) * pageSize;
				const result = await entry.registration.queue.getJobLogs(
					jobId,
					start,
					start + pageSize - 1,
				);
				let clipped = false;
				const lines = result.logs.map((line) => {
					if (line.length > TEXT_LIMIT) clipped = true;
					return clip(line) ?? "";
				});
				return {
					lines,
					total: result.count,
					page,
					pageSize,
					clipped,
				};
			});
		},
		async schedulers({
			queueKey,
			page = 1,
		}: {
			queueKey: string;
			page?: number;
		}) {
			const entry = requireQueue(queueKey);
			if (!entry) return null;
			return read(async () => {
				const [rows, total] = await Promise.all([
					entry.adapter.getJobSchedulers((page - 1) * 50, page * 50 - 1),
					entry.adapter.getJobSchedulersCount(),
				]);
				return {
					items: rows.map((row) => ({
						id: row.id,
						name: row.name ?? row.id,
						pattern: row.pattern ?? null,
						every: row.every ?? null,
						tz: row.tz ?? null,
						next: row.next ?? null,
						lastTrigger:
							typeof row.lastRun === "number"
								? { kind: "inferred" as const, at: row.lastRun }
								: { kind: "unknown" as const },
					})),
					total,
					page,
					refreshedAt: new Date().toISOString(),
				};
			});
		},
	};
}

export type QueueMonitor = ReturnType<typeof createQueueMonitor>;
