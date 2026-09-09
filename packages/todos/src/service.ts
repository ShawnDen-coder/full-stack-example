import type { Database } from "@full-stack-example/database";
import { withTenantTransaction } from "@full-stack-example/database";
import { createTenantTodoRepository } from "./repository.js";
import type { CreateTodoInput, Todo, UpdateTodoInput } from "./schemas.js";

export interface TenantTodoService {
  readonly listTodos: (tenantId: string) => Promise<readonly Todo[]>;
  readonly createTodo: (tenantId: string, input: CreateTodoInput) => Promise<Todo>;
  readonly updateTodo: (
    tenantId: string,
    input: { readonly id: number } & UpdateTodoInput,
  ) => Promise<Todo | undefined>;
  readonly deleteTodo: (tenantId: string, input: { readonly id: number }) => Promise<boolean>;
}

export function createTodoService(options: { readonly database: Database }): TenantTodoService {
  return {
    listTodos: (tenantId) =>
      withTenantTransaction(options.database, tenantId, (tx) =>
        createTenantTodoRepository(tx, tenantId).list(),
      ),
    createTodo: (tenantId, input) =>
      withTenantTransaction(options.database, tenantId, (tx) =>
        createTenantTodoRepository(tx, tenantId).create(input),
      ),
    updateTodo: (tenantId, input) =>
      withTenantTransaction(options.database, tenantId, (tx) =>
        createTenantTodoRepository(tx, tenantId).updateCompleted(input),
      ),
    deleteTodo: (tenantId, input) =>
      withTenantTransaction(options.database, tenantId, (tx) =>
        createTenantTodoRepository(tx, tenantId).delete(input),
      ),
  };
}
