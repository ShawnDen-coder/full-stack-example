import type { Logger } from "@my-better-t-app/logger";
import {
	createQueueConnection,
	USER_PROFILE_QUEUE,
	type UserProfileJobData,
	type UserProfileJobResult,
	userProfileJobSchema,
	Worker,
} from "@my-better-t-app/queue";
import type { UsersService } from "../index";

export function createUserProfileProcessor({
	usersService,
}: {
	usersService: UsersService;
}) {
	return async (data: UserProfileJobData): Promise<UserProfileJobResult> => {
		const { userId } = userProfileJobSchema.parse(data);
		const profile = await usersService.getProfile(userId);
		return profile
			? {
					id: profile.id,
					name: profile.name,
					emailVerified: profile.emailVerified,
				}
			: null;
	};
}

export function createUserProfileWorker({
	redisUrl,
	usersService,
	concurrency = 5,
	autorun = true,
	logger,
}: {
	redisUrl: string;
	usersService: UsersService;
	concurrency?: number;
	autorun?: boolean;
	logger?: Logger;
}) {
	const process = createUserProfileProcessor({ usersService });
	const connection = {
		...createQueueConnection(redisUrl),
		maxRetriesPerRequest: null,
		enableOfflineQueue: true,
	};
	const worker = new Worker<UserProfileJobData, UserProfileJobResult>(
		USER_PROFILE_QUEUE,
		(job) => {
			if (job.name !== "profile")
				throw new Error("Unsupported user profile task");
			return process(job.data);
		},
		{ connection, concurrency, autorun },
	);
	worker.on("error", (err) =>
		logger?.error({ err }, "User profile worker connection error"),
	);
	worker.on("failed", (job, err) =>
		logger?.error(
			{ err, jobId: job?.id, requestId: job?.data.requestId },
			"User profile job failed",
		),
	);
	worker.on("completed", (job) =>
		logger?.info(
			{ jobId: job.id, requestId: job.data.requestId },
			"User profile job completed",
		),
	);
	return worker;
}
