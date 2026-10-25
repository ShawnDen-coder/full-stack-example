import type { Database } from "@my-better-t-app/db";
import { todo } from "@my-better-t-app/db/schema/todo";
import { and, desc, eq, lt } from "drizzle-orm";

// A database or transaction can execute these operations; the repository owns neither.
type TodoExecutor = Pick<Database, "select" | "insert" | "update" | "delete">;
const fields = { id: todo.id, text: todo.text, completed: todo.completed };

export function createTodosRepository(db: TodoExecutor) {
	return {
		// Bind once per scope. Never store the current user on the shared repository.
		forUser(userId: string) {
			const owner = eq(todo.userId, userId);
			const ownedTodo = (id: number) => and(owner, eq(todo.id, id));
			return {
				async list({ cursor, limit }: { cursor?: number; limit: number }) {
					return db
						.select(fields)
						.from(todo)
						.where(
							and(
								owner,
								cursor === undefined ? undefined : lt(todo.id, cursor),
							),
						)
						.orderBy(desc(todo.id))
						.limit(limit);
				},
				async create({ text }: { text: string }) {
					const [created] = await db
						.insert(todo)
						.values({ userId, text })
						.returning(fields);
					if (!created) throw new Error("Todo insert returned no row");
					return created;
				},
				async setCompleted(id: number, completed: boolean) {
					const [updated] = await db
						.update(todo)
						.set({ completed })
						.where(ownedTodo(id))
						.returning(fields);
					return updated ?? null;
				},
				async delete(id: number) {
					const [deleted] = await db
						.delete(todo)
						.where(ownedTodo(id))
						.returning({ id: todo.id });
					return deleted ?? null;
				},
			};
		},
	};
}
