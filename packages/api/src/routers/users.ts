import { ProfileJobsUnavailableError } from "@full-stack-example/domain/users/jobs/profile-read/errors";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { protectedProcedure } from "../procedures";

async function withProfileJobs<T>(work: () => Promise<T>) {
	try {
		return await work();
	} catch (error) {
		if (error instanceof ProfileJobsUnavailableError)
			throw new ORPCError("SERVICE_UNAVAILABLE");
		throw error;
	}
}
const enqueueProfileRead = protectedProcedure.handler(({ context }) =>
	withProfileJobs(() =>
		context.services.profileJobs.enqueueProfileRead({
			userId: context.session.user.id,
			requestId: context.requestId,
		}),
	),
);
const getProfileReadJob = protectedProcedure
	.input(z.object({ id: z.string().min(1).max(128) }))
	.handler(async ({ context, input }) => {
		const job = await withProfileJobs(() =>
			context.services.profileJobs.getProfileReadJob({
				jobId: input.id,
				userId: context.session.user.id,
			}),
		);
		if (!job) throw new ORPCError("NOT_FOUND");
		return job;
	});
export const usersRouter = {
	me: protectedProcedure.handler(async ({ context }) => {
		const profile = await context.services.usersService.getProfile(
			context.session.user.id,
		);
		if (!profile) throw new ORPCError("NOT_FOUND");
		return profile;
	}),
	enqueueProfileRead,
	getProfileReadJob,
	// Compatibility aliases for existing clients.
	requestProfile: enqueueProfileRead,
	profileJob: getProfileReadJob,
};
