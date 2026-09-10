import { Hono } from "hono";
import { testClient } from "hono/testing";
import { describe, expect, it, vi } from "vitest";
import { setupTodosApp } from "../src/route.js";
import type { TenantTodoService } from "../src/service.js";

describe("Todo route integration", () => {
  it("accepts a host tenant resolver and preserves subsequent root routes", async () => {
    const listTodos = vi.fn(async () => []);
    const service: TenantTodoService = {
      listTodos,
      createTodo: async () => {
        throw new Error("unused");
      },
      updateTodo: async () => undefined,
      deleteTodo: async () => false,
    };
    const authorize = async (_c: unknown, next: () => Promise<void>) => next();
    const app = setupTodosApp(new Hono(), {
      service,
      authorization: { read: authorize, write: authorize, delete: authorize },
      getTenantId: () => "external-tenant",
    }).get("/dashboard", (c) => c.text("dashboard"));
    const client = testClient(app);
    expect((await client.api.todos.$get()).status).toBe(200);
    expect(listTodos).toHaveBeenCalledWith("external-tenant");
    expect((await app.request("/dashboard")).status).toBe(200);
    expect((await app.request("/api/dashboard")).status).toBe(404);
  });
});
