import { describe, expect, it } from "vitest";
import { createTodoService, type TodoRepository } from "../src/index.js";

function createRepository(): TodoRepository {
  let nextId = 1;
  const records = new Map<number, { id: number; title: string; completed: boolean }>();
  return {
    list: async () => [...records.values()].sort((left, right) => right.id - left.id),
    create: async ({ title }) => {
      const todo = { id: nextId, title, completed: false };
      nextId += 1;
      records.set(todo.id, todo);
      return todo;
    },
    updateCompleted: async ({ id, completed }) => {
      const todo = records.get(id);
      if (!todo) return undefined;
      const updated = { ...todo, completed };
      records.set(id, updated);
      return updated;
    },
    delete: async ({ id }) => records.delete(id),
  };
}

describe("Todo service", () => {
  it("creates todos and returns them in descending identifier order", async () => {
    const service = createTodoService(createRepository());
    await service.createTodo({ title: "First" });
    await service.createTodo({ title: "Second" });

    await expect(service.listTodos()).resolves.toEqual([
      { id: 2, title: "Second", completed: false },
      { id: 1, title: "First", completed: false },
    ]);
  });

  it("updates completion and reports missing todos", async () => {
    const service = createTodoService(createRepository());
    const todo = await service.createTodo({ title: "Finish me" });

    await expect(service.updateTodo({ id: todo.id, completed: true })).resolves.toEqual({
      ...todo,
      completed: true,
    });
    await expect(service.updateTodo({ id: 99, completed: true })).resolves.toBeUndefined();
  });

  it("deletes todos and reports missing todos", async () => {
    const service = createTodoService(createRepository());
    const todo = await service.createTodo({ title: "Remove me" });

    await expect(service.deleteTodo({ id: todo.id })).resolves.toBe(true);
    await expect(service.deleteTodo({ id: todo.id })).resolves.toBe(false);
  });
});
