import type { Database } from "@full-stack-example/database";
import { todos, type TenantTransaction } from "@full-stack-example/database";
import { desc, eq } from "drizzle-orm";
import type { CreateTodoInput, Todo, UpdateTodoInput } from "./schemas.js";

export function createTodoRepository(database: Database) {
  return {
    list: async (): Promise<readonly Todo[]> =>
      database.select().from(todos).orderBy(desc(todos.id)),
    create: async (input: CreateTodoInput): Promise<Todo> => {
      const [todo] = await database.insert(todos).values(input).returning();
      if (!todo) throw new Error("Todo insert returned no result");
      return todo;
    },
    updateCompleted: async (
      input: { readonly id: number } & UpdateTodoInput,
    ): Promise<Todo | undefined> => {
      const [todo] = await database
        .update(todos)
        .set({ completed: input.completed })
        .where(eq(todos.id, input.id))
        .returning();
      return todo;
    },
    delete: async (input: { readonly id: number }): Promise<boolean> => {
      const [todo] = await database.delete(todos).where(eq(todos.id, input.id)).returning();
      return todo !== undefined;
    },
  };
}

/** Tenant-scoped repository. The transaction must be created with withTenantTransaction. */
export function createTenantTodoRepository(transaction: TenantTransaction) {
  return {
    list: async (): Promise<readonly Todo[]> =>
      transaction.select().from(todos).orderBy(desc(todos.id)),
    create: async (input: CreateTodoInput): Promise<Todo> => {
      const [todo] = await transaction.insert(todos).values(input).returning();
      if (!todo) throw new Error("Todo insert returned no result");
      return todo;
    },
    updateCompleted: async (input: { readonly id: number } & UpdateTodoInput) => {
      const [todo] = await transaction
        .update(todos)
        .set({ completed: input.completed })
        .where(eq(todos.id, input.id))
        .returning();
      return todo;
    },
    delete: async (input: { readonly id: number }): Promise<boolean> => {
      const [todo] = await transaction.delete(todos).where(eq(todos.id, input.id)).returning();
      return todo !== undefined;
    },
  };
}
