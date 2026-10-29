import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { pageProcedure } from "../procedures";

const protectedProcedure = pageProcedure("todos");
const workspaceId = z.string().min(1).max(100);
const id = z.number().int().positive();
const setCompletedProcedure = protectedProcedure
	.input(z.object({ workspaceId, id, completed: z.boolean() }))
	.handler(async ({ input, context }) => {
		const result = await context.services.todosService.setCompleted({
			userId: context.session.user.id,
			workspaceId: context.workspaceId,
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
				workspaceId,
				cursor: id.optional(),
				limit: z.number().int().min(1).max(100).default(20),
			}),
		)
		.handler(({ input, context }) =>
			context.services.todosService.list({
				...input,
				userId: context.session.user.id,
				workspaceId: context.workspaceId,
			}),
		),
	create: protectedProcedure
		.input(z.object({ workspaceId, text: z.string().trim().min(1).max(500) }))
		.handler(({ input, context }) =>
			context.services.todosService.create({
				userId: context.session.user.id,
				workspaceId: context.workspaceId,
				text: input.text,
			}),
		),
	rename: protectedProcedure
		.input(
			z.object({ workspaceId, id, text: z.string().trim().min(1).max(500) }),
		)
		.handler(async ({ input, context }) => {
			const updated = await context.services.todosService.rename({
				...input,
				userId: context.session.user.id,
				workspaceId: context.workspaceId,
			});
			if (!updated) throw new ORPCError("NOT_FOUND");
			return updated;
		}),
	setCompleted: setCompletedProcedure,
	// Compatibility alias for existing clients.
	toggle: setCompletedProcedure,
	delete: protectedProcedure
		.input(z.object({ workspaceId, id }))
		.handler(async ({ input, context }) => {
			const result = await context.services.todosService.delete({
				userId: context.session.user.id,
				workspaceId: context.workspaceId,
				id: input.id,
			});
			if (!result) throw new ORPCError("NOT_FOUND");
			return result;
		}),
};
