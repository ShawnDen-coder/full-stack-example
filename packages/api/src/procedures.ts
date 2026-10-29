import type { PageKey } from "@full-stack-example/access";
import { ORPCError, os } from "@orpc/server";
import { APIError } from "better-auth/api";

import type { Context } from "./context";

export const publicProcedure = os.$context<Context>().use(async ({ next }) => {
	try {
		return await next();
	} catch (error) {
		if (error instanceof APIError)
			throw new ORPCError(
				error.statusCode === 401
					? "UNAUTHORIZED"
					: error.statusCode === 403
						? "FORBIDDEN"
						: "INTERNAL_SERVER_ERROR",
				{ message: error.message },
			);
		throw error;
	}
});

const requireAuth = os
	.$context<Context>()
	.middleware(async ({ context, next }) => {
		if (!context.session?.user) {
			throw new ORPCError("UNAUTHORIZED");
		}
		return next({
			context: {
				session: context.session,
			},
		});
	});

export const protectedProcedure = publicProcedure.use(requireAuth);

export function pageProcedure(page: PageKey) {
	return protectedProcedure.use(async ({ context, next }) => {
		const allowed = await context.services.accessService.canReadPage(
			context.headers,
			page,
		);
		if (!allowed) throw new ORPCError("FORBIDDEN");
		return next();
	});
}
