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
}: {
	redisUrl: string;
	usersService: UsersService;
	concurrency?: number;
	autorun?: boolean;
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
	worker.on("error", () =>
		console.error("User profile worker connection error"),
	);
	worker.on("failed", (job) =>
		console.error("User profile job failed", { jobId: job?.id }),
	);
	return worker;
}
