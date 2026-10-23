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
	// A worker can finish between getJob and getState. Reload the result after
	// observing completion so the response never pairs "completed" with stale data.
	const completed = state === "completed" ? await queue.getJob(jobId) : null;
	if (state === "completed" && (!completed || completed.data.userId !== userId))
		return null;
	return {
		id: job.id ?? jobId,
		state,
		result: completed?.returnvalue ?? null,
	};
}
