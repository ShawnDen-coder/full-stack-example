import type { CreateTodoInput, Todo, UpdateTodoInput } from "./schemas.js";

export interface TodoRepository {
  readonly list: () => Promise<readonly Todo[]>;
  readonly create: (input: CreateTodoInput) => Promise<Todo>;
  readonly updateCompleted: (
    input: { readonly id: number } & UpdateTodoInput,
  ) => Promise<Todo | undefined>;
  readonly delete: (input: { readonly id: number }) => Promise<boolean>;
}

export function createTodoService(repository: TodoRepository) {
  return {
    listTodos: (): Promise<readonly Todo[]> => repository.list(),
    createTodo: (input: CreateTodoInput): Promise<Todo> => repository.create(input),
    updateTodo: (input: { readonly id: number } & UpdateTodoInput): Promise<Todo | undefined> =>
      repository.updateCompleted(input),
    deleteTodo: (input: { readonly id: number }): Promise<boolean> => repository.delete(input),
  };
}

export type TodoService = ReturnType<typeof createTodoService>;
