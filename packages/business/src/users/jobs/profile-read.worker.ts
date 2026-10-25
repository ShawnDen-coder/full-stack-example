import {
	createQueueMetrics,
	type Logger,
	safeText,
} from "@my-better-t-app/observability";
import {
	createQueueConnection,
	createQueueTelemetry,
	Worker,
} from "@my-better-t-app/queue";
import type { UsersService } from "../service";
import {
	USER_PROFILE_QUEUE,
	USER_PROFILE_TASK,
	type UserProfileJobData,
	type UserProfileJobResult,
} from "./profile-read.contract";
import { createProfileReadProcessor } from "./profile-read.processor";

export { createProfileReadProcessor } from "./profile-read.processor";

export function createProfileReadWorker({
	redisUrl,
	usersService,
	concurrency = 5,
	logger,
}: {
	redisUrl: string;
	usersService: UsersService;
	concurrency?: number;
	logger?: Logger;
}) {
	const processProfile = createProfileReadProcessor({ usersService });
	const jobMetrics = createQueueMetrics(USER_PROFILE_QUEUE);
	const worker = new Worker<UserProfileJobData, UserProfileJobResult>(
		USER_PROFILE_QUEUE,
		async (job) => {
			const started = performance.now();
			jobMetrics.start(job.timestamp);
			const log = logger?.child({
				job_id: job.id,
				job_name: job.name,
				request_id: job.data.requestId,
				attempt: job.attemptsMade + 1,
			});
			try {
				if (job.name !== USER_PROFILE_TASK)
					throw new Error("Unsupported user profile task");
				const result = await processProfile(job.data);
				jobMetrics.finish("completed", (performance.now() - started) / 1000);
				log?.info(
					{
						event: "job.completed",
						duration_ms: Math.round(performance.now() - started),
					},
					"User profile job completed",
				);
				return result;
			} catch (error) {
				const retrying = job.attemptsMade + 1 < (job.opts.attempts ?? 1);
				jobMetrics.finish(
					retrying ? "retry" : "failed",
					(performance.now() - started) / 1000,
				);
				log?.[retrying ? "warn" : "error"](
					{ err: error, event: retrying ? "job.retry" : "job.failed" },
					"User profile job attempt failed",
				);
				// BullMQ telemetry also records failures: sanitize before crossing that boundary.
				throw new Error(
					error instanceof Error
						? safeText(error.message)
						: "Profile job failed",
				);
			}
		},
		{
			connection: createQueueConnection(redisUrl, "worker"),
			concurrency,
			autorun: false,
			telemetry: createQueueTelemetry(),
		},
	);
	worker.on("error", (err) =>
		logger?.error(
			{ err, event: "worker.connection_error" },
			"User profile worker connection error",
		),
	);
	worker.on("stalled", (jobId) =>
		logger?.warn(
			{ job_id: jobId, event: "job.stalled" },
			"User profile job stalled",
		),
	);
	return worker;
}
