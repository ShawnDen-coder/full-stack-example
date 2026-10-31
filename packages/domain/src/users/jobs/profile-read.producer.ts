import { type Logger, observeQueue } from "@full-stack-example/observability";
import {
	createQueueConnection,
	createQueueTelemetry,
	Queue,
} from "@full-stack-example/queue";
import {
	profileReadJobOptions,
	USER_PROFILE_QUEUE,
	USER_PROFILE_TASK,
	type UserProfileJobData,
	type UserProfileJobResult,
	userProfileJobSchema,
} from "./profile-read.contract";
import { ProfileJobsUnavailableError } from "./profile-read.errors";
import { getProfileReadJob } from "./profile-read.status";

export function createProfileReadClient({
	redisUrl,
	logger,
}: {
	redisUrl: string;
	logger?: Logger;
}) {
	const profileQueue = new Queue<
		UserProfileJobData,
		UserProfileJobResult,
		typeof USER_PROFILE_TASK
	>(USER_PROFILE_QUEUE, {
		connection: createQueueConnection(redisUrl),
		telemetry: createQueueTelemetry(),
		defaultJobOptions: profileReadJobOptions,
	});
	// EventEmitter errors must be handled even when the producer is idle.
	profileQueue.on("error", (err) =>
		logger?.error({ err }, "User profile queue connection error"),
	);

	const stopMetrics = observeQueue(profileQueue, USER_PROFILE_QUEUE);
	return {
		async enqueueProfileRead({
			userId,
			requestId,
		}: {
			userId: string;
			requestId?: string;
		}) {
			const data = userProfileJobSchema.parse({ userId, requestId });
			const job = await profileQueue.add(USER_PROFILE_TASK, data).catch(() => {
				throw new ProfileJobsUnavailableError();
			});
			if (!job.id) throw new Error("Queue did not return a job ID");
			logger?.info(
				{ event: "job.enqueued", job_id: job.id, request_id: requestId },
				"User profile job enqueued",
			);
			return { id: job.id };
		},
		getProfileReadJob: ({ jobId, userId }: { jobId: string; userId: string }) =>
			getProfileReadJob(profileQueue, jobId, userId).catch(() => {
				throw new ProfileJobsUnavailableError();
			}),
		async close() {
			await stopMetrics();
			await profileQueue.close();
		},
		async checkReady() {
			await profileQueue.getJobCounts("waiting");
		},
		// Assembly-only handle. The server monitors this instance; callers must not close it.
		getQueueForMonitoring(): Queue<
			UserProfileJobData,
			UserProfileJobResult,
			typeof USER_PROFILE_TASK
		> {
			return profileQueue;
		},
	};
}

export type ProfileReadClient = ReturnType<typeof createProfileReadClient>;
