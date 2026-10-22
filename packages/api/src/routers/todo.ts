import { todo } from "@my-better-t-app/db/schema/todo";
import { and, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure } from "../index";

export const todoRouter = {
	getAll: protectedProcedure.handler(async ({ context }) => {
		return await context.db
			.select()
			.from(todo)
			.where(eq(todo.userId, context.session.user.id));
	}),

	create: protectedProcedure
		.input(z.object({ text: z.string().min(1) }))
		.handler(async ({ input, context }) => {
			return await context.db.insert(todo).values({
				text: input.text,
				userId: context.session.user.id,
			});
		}),

	toggle: protectedProcedure
		.input(z.object({ id: z.number(), completed: z.boolean() }))
		.handler(async ({ input, context }) => {
			return await context.db
				.update(todo)
				.set({ completed: input.completed })
				.where(
					and(eq(todo.id, input.id), eq(todo.userId, context.session.user.id)),
				);
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.number() }))
		.handler(async ({ input, context }) => {
			return await context.db
				.delete(todo)
				.where(
					and(eq(todo.id, input.id), eq(todo.userId, context.session.user.id)),
				);
		}),
};
