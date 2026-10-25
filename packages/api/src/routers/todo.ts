import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { protectedProcedure } from "../procedures";

const id = z.number().int().positive();
const setCompletedProcedure = protectedProcedure
	.input(z.object({ id, completed: z.boolean() }))
	.handler(async ({ input, context }) => {
		const result = await context.services.todosService.setCompleted({
			userId: context.session.user.id,
			id: input.id,
			completed: input.completed,
		});
		if (!result) throw new ORPCError("NOT_FOUND");
		return result;
	});

export const todoRouter = {
	list: protectedProcedure
		.input(
			z.object({
				cursor: id.optional(),
				limit: z.number().int().min(1).max(100).default(20),
			}),
		)
		.handler(({ input, context }) =>
			context.services.todosService.list({
				...input,
				userId: context.session.user.id,
			}),
		),
	create: protectedProcedure
		.input(z.object({ text: z.string().trim().min(1).max(500) }))
		.handler(({ input, context }) =>
			context.services.todosService.create({
				userId: context.session.user.id,
				text: input.text,
			}),
		),
	setCompleted: setCompletedProcedure,
	// Compatibility alias for existing clients.
	toggle: setCompletedProcedure,
	delete: protectedProcedure
		.input(z.object({ id }))
		.handler(async ({ input, context }) => {
			const result = await context.services.todosService.delete({
				userId: context.session.user.id,
				id: input.id,
			});
			if (!result) throw new ORPCError("NOT_FOUND");
			return result;
		}),
};
