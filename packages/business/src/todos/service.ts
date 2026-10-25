import type { Database } from "@full-stack-example/db";
import { observeOperation } from "@full-stack-example/observability";
import { createTodosRepository } from "./repository";

export function createTodosService({ db }: { db: Database }) {
	const repository = createTodosRepository({ db });
	return {
		async list({
			userId,
			cursor,
			limit,
		}: {
			userId: string;
			cursor?: number;
			limit: number;
		}) {
			const rows = await observeOperation("todos.list", async () =>
				repository.forUser(userId).list({ cursor, limit: limit + 1 }),
			);
			const items = rows.slice(0, limit);
			return {
				items,
				nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
			};
		},
		async create({ userId, text }: { userId: string; text: string }) {
			return observeOperation("todos.create", async () =>
				repository.forUser(userId).create({ text }),
			);
		},
		async setCompleted({
			userId,
			id,
			completed,
		}: {
			userId: string;
			id: number;
			completed: boolean;
		}) {
			return observeOperation("todos.setCompleted", async () =>
				repository.forUser(userId).setCompleted({ id, completed }),
			);
		},
		async delete({ userId, id }: { userId: string; id: number }) {
			return observeOperation("todos.delete", async () =>
				repository.forUser(userId).delete(id),
			);
		},
	};
}

export type TodosService = ReturnType<typeof createTodosService>;
