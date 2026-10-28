import type { RouterClient } from "@orpc/server";
import { protectedProcedure, publicProcedure } from "../procedures";
import { accessRouter } from "./access";
import { queuesRouter } from "./queues";
import { todoRouter } from "./todo";
import { usersRouter } from "./users";

export const appRouter = {
	access: accessRouter,
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	privateData: protectedProcedure.handler(({ context }) => {
		return {
			message: "This is private",
			user: context.session?.user,
		};
	}),
	todo: todoRouter,
	users: usersRouter,
	queues: queuesRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
