import type { Database } from "@my-better-t-app/db";
import { todo } from "@my-better-t-app/db/schema/todo";
import { and, desc, eq, lt } from "drizzle-orm";

const fields = { id: todo.id, text: todo.text, completed: todo.completed };

export function createTodosService({
	deps: { db },
}: {
	deps: { db: Database };
}) {
	const owned = (userId: string, id: number) =>
		and(eq(todo.userId, userId), eq(todo.id, id));
	return {
		async list(
			userId: string,
			{ cursor, limit }: { cursor?: number; limit: number },
		) {
			const rows = await db
				.select(fields)
				.from(todo)
				.where(
					and(
						eq(todo.userId, userId),
						cursor === undefined ? undefined : lt(todo.id, cursor),
					),
				)
				.orderBy(desc(todo.id))
				.limit(limit + 1);
			const items = rows.slice(0, limit);
			return {
				items,
				nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
			};
		},
		async create(userId: string, text: string) {
			const [created] = await db
				.insert(todo)
				.values({ userId, text })
				.returning(fields);
			if (!created) throw new Error("Todo insert returned no row");
			return created;
		},
		async toggle(userId: string, id: number, completed: boolean) {
			const [updated] = await db
				.update(todo)
				.set({ completed })
				.where(owned(userId, id))
				.returning(fields);
			return updated ?? null;
		},
		async delete(userId: string, id: number) {
			const [deleted] = await db
				.delete(todo)
				.where(owned(userId, id))
				.returning({ id: todo.id });
			return deleted ?? null;
		},
	};
}

export type TodosService = ReturnType<typeof createTodosService>;
