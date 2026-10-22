import type { UserProfileJobData, UserProfileJobResult } from "./jobs";

type ProfileJob = {
	id?: string;
	data: UserProfileJobData;
	returnvalue: UserProfileJobResult;
	getState(): Promise<string>;
};

type ProfileQueueReader = {
	getJob(id: string): Promise<ProfileJob | undefined>;
};

export async function getUserProfileJob(
	queue: ProfileQueueReader,
	jobId: string,
	userId: string,
) {
	const job = await queue.getJob(jobId);
	if (!job || job.data.userId !== userId) return null;
	const state = await job.getState();
	return {
		id: job.id ?? jobId,
		state,
		result: state === "completed" ? job.returnvalue : null,
	};
}
