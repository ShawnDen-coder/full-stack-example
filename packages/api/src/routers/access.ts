import { protectedProcedure } from "../procedures";
export const accessRouter = {
	me: protectedProcedure.handler(({ context }) =>
		context.services.accessService.getAccess(context.headers),
	),
};
