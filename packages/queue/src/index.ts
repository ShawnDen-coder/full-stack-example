import type { Logger } from "@my-better-t-app/logger";
import { type ConnectionOptions, Queue } from "bullmq";
import {
	USER_PROFILE_QUEUE,
	type UserProfileJobData,
	type UserProfileJobResult,
	userProfileJobSchema,
} from "./jobs";
import { getUserProfileJob } from "./user-profile-job";

export { Worker } from "bullmq";
export * from "./jobs";

export function createQueueConnection(redisUrl: string): ConnectionOptions {
	const url = new URL(redisUrl);
	const db = Number(url.pathname.slice(1) || 0);
	if (
		!["redis:", "rediss:"].includes(url.protocol) ||
		!Number.isInteger(db) ||
		db < 0
	) {
		throw new Error("Invalid Redis connection configuration");
	}
	return {
		host: url.hostname.replace(/^\[|\]$/g, ""),
		port: Number(url.port || 6379),
		username: url.username ? decodeURIComponent(url.username) : undefined,
		password: url.password ? decodeURIComponent(url.password) : undefined,
		db,
		tls: url.protocol === "rediss:" ? {} : undefined,
		maxRetriesPerRequest: 1,
		enableOfflineQueue: false,
		connectTimeout: 5000,
	};
}

export function createQueueClient({
	redisUrl,
	logger,
}: {
	redisUrl: string;
	logger?: Logger;
}) {
	const profileQueue = new Queue<
		UserProfileJobData,
		UserProfileJobResult,
		"profile"
	>(USER_PROFILE_QUEUE, {
		connection: createQueueConnection(redisUrl),
		defaultJobOptions: {
			attempts: 3,
			backoff: { type: "exponential", delay: 1000 },
			removeOnComplete: { age: 3600, count: 1000 },
			removeOnFail: { age: 86400, count: 1000 },
		},
	});
	// EventEmitter errors must be handled even when the producer is idle.
	profileQueue.on("error", (err) =>
		logger?.error({ err }, "User profile queue connection error"),
	);

	return {
		async enqueueUserProfile(userId: string, requestId?: string) {
			const job = await profileQueue.add(
				"profile",
				userProfileJobSchema.parse({ userId, requestId }),
			);
			if (!job.id) throw new Error("Queue did not return a job ID");
			logger?.info({ jobId: job.id, requestId }, "User profile job enqueued");
			return { id: job.id };
		},
		getUserProfileJob: (jobId: string, userId: string) =>
			getUserProfileJob(profileQueue, jobId, userId),
		close: () => profileQueue.close(),
		async checkReady() {
			await profileQueue.getJobCounts("waiting");
		},
	};
}

export type QueueClient = ReturnType<typeof createQueueClient>;
