import { Hono } from "hono";
import { hc } from "hono/client";
import { describe, expect, it, vi } from "vitest";
import { setupTodosApp, type TodosApiType } from "../src/route.js";
import type { TenantTodoService } from "../src/service.js";

describe("Todo route integration", () => {
  it("accepts a host tenant resolver and preserves subsequent root routes", async () => {
    const listTodos = vi.fn(async () => []);
    const createTodo = vi.fn(async (_tenantId: string, input: { readonly title: string }) => ({
      id: 1,
      title: input.title,
      completed: false,
    }));
    const updateTodo = vi.fn(async () => ({ id: 1, title: "new title", completed: true }));
    const deleteTodo = vi.fn(async () => true);
    const service: TenantTodoService = {
      listTodos,
      createTodo,
      updateTodo,
      deleteTodo,
    };
    const authorize = async (_c: unknown, next: () => Promise<void>) => next();
    const app = setupTodosApp(new Hono(), {
      service,
      authorization: { read: authorize, write: authorize, delete: authorize },
      getTenantId: () => "external-tenant",
    }).get("/dashboard", (c) => c.text("dashboard"));
    const client = hc<TodosApiType>("http://localhost", { fetch: app.request.bind(app) });
    expect((await client.api.todos.$get()).status).toBe(200);
    expect((await client.api.todos.$post({ json: { title: "new title" } })).status).toBe(201);
    expect(
      (
        await client.api.todos[":id"].$patch({
          param: { id: "1" },
          json: { completed: true },
        })
      ).status,
    ).toBe(200);
    expect((await client.api.todos[":id"].$delete({ param: { id: "1" } })).status).toBe(204);
    expect(listTodos).toHaveBeenCalledWith("external-tenant");
    expect(createTodo).toHaveBeenCalledWith("external-tenant", { title: "new title" });
    expect(updateTodo).toHaveBeenCalledWith("external-tenant", { id: 1, completed: true });
    expect(deleteTodo).toHaveBeenCalledWith("external-tenant", { id: 1 });
    expect((await app.request("/dashboard")).status).toBe(200);
    expect((await app.request("/api/dashboard")).status).toBe(404);
  });
});
