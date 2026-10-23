import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { protectedProcedure } from "../index";

export const usersRouter = {
	me: protectedProcedure.handler(async ({ context }) => {
		const profile = await context.services.usersService.getProfile(
			context.session.user.id,
		);
		if (!profile) throw new ORPCError("NOT_FOUND");
		return profile;
	}),
	requestProfile: protectedProcedure.handler(({ context }) =>
		context.services.queueClient.enqueueUserProfile(
			context.session.user.id,
			context.requestId,
		),
	),
	profileJob: protectedProcedure
		.input(z.object({ id: z.string().min(1).max(128) }))
		.handler(async ({ context, input }) => {
			const job = await context.services.queueClient.getUserProfileJob(
				input.id,
				context.session.user.id,
			);
			if (!job) throw new ORPCError("NOT_FOUND");
			return job;
		}),
};
