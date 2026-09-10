import { type TenantTransaction, todos } from "@full-stack-example/database";
import { and, desc, eq } from "drizzle-orm";
import type { CreateTodoInput, Todo, UpdateTodoInput } from "./schemas.js";

// The HTTP contract deliberately excludes persistence fields such as tenantId.
const todoFields = { id: todos.id, title: todos.title, completed: todos.completed };

/** Tenant-scoped repository. The transaction must be created with withTenantTransaction. */
export function createTenantTodoRepository(transaction: TenantTransaction, tenantId: string) {
  return {
    list: async (): Promise<readonly Todo[]> =>
      transaction
        .select(todoFields)
        .from(todos)
        .where(eq(todos.tenantId, tenantId))
        .orderBy(desc(todos.id)),
    create: async (input: CreateTodoInput): Promise<Todo> => {
      const [todo] = await transaction
        .insert(todos)
        .values({ ...input, tenantId })
        .returning(todoFields);
      if (!todo) throw new Error("Todo insert returned no result");
      return todo;
    },
    updateCompleted: async (input: { readonly id: number } & UpdateTodoInput) => {
      const [todo] = await transaction
        .update(todos)
        .set({ completed: input.completed })
        .where(and(eq(todos.id, input.id), eq(todos.tenantId, tenantId)))
        .returning(todoFields);
      return todo;
    },
    delete: async (input: { readonly id: number }): Promise<boolean> => {
      const [todo] = await transaction
        .delete(todos)
        .where(and(eq(todos.id, input.id), eq(todos.tenantId, tenantId)))
        .returning();
      return todo !== undefined;
    },
  };
}
