import { configureLogging, getAppLogger } from "@full-stack-example/logging";
import type { TenantTodoService } from "@full-stack-example/todos";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

let logger = getAppLogger("test");

function createService(): TenantTodoService {
  let nextId = 1;
  const records = new Map<number, { id: number; title: string; completed: boolean }>();
  return {
    listTodos: async () => [...records.values()].sort((left, right) => right.id - left.id),
    createTodo: async (_tenantId, { title }) => {
      const todo = { id: nextId, title, completed: false };
      nextId += 1;
      records.set(todo.id, todo);
      return todo;
    },
    updateTodo: async (_tenantId, { id, completed }) => {
      const todo = records.get(id);
      if (!todo) return undefined;
      const updated = { ...todo, completed };
      records.set(id, updated);
      return updated;
    },
    deleteTodo: async (_tenantId, { id }) => records.delete(id),
  };
}

function createTestApp() {
  const requireTenant = async (context: any, next: any) => {
    context.set("tenantPrincipal", { tenantId: "tenant-test" });
    await next();
  };
  const pass = async (_context: any, next: any) => next();
  return createApp({
    logger,
    http: { webOrigin: "http://localhost:5173" },
    documentation: { enabled: true },
    modules: {
      system: { checkDatabase: async () => undefined },
      todos: { service: createService() },
      auth: {
        require: {
          requireTenant,
          requireTenantPermission: () => requireTenant,
          requireSession: pass,
          requirePlatformAdmin: pass,
          requireFreshSession: pass,
          requirePermission: () => requireTenant,
        },
        auth: { handler: async () => new Response("handled") },
        platform: {
          createUser: async () => ({ id: "user" }),
          createOrganization: async () => ({ id: "org" }),
          setOrganizationStatus: async () => undefined,
          requestPasswordReset: async () => undefined,
        },
      },
    } as any,
    web: {},
  });
}

beforeAll(async () => {
  await configureLogging({ service: "test", environment: "test", level: "silent", pretty: false });
  logger = getAppLogger("test");
});

describe("Todo API", () => {
  it("creates, lists, updates, and deletes todos", async () => {
    const app = createTestApp();
    const createdResponse = await app.request("http://localhost/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Learn Hono" }),
    });
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();
    expect(created).toEqual({ id: 1, title: "Learn Hono", completed: false });

    const listResponse = await app.request("http://localhost/api/todos");
    await expect(listResponse.json()).resolves.toEqual({ todos: [created] });

    const updatedResponse = await app.request("http://localhost/api/todos/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    expect(updatedResponse.status).toBe(200);
    await expect(updatedResponse.json()).resolves.toEqual({
      id: 1,
      title: "Learn Hono",
      completed: true,
    });

    const deletedResponse = await app.request("http://localhost/api/todos/1", { method: "DELETE" });
    expect(deletedResponse.status).toBe(204);
  });

  it("rejects invalid inputs and reports missing todos", async () => {
    const app = createTestApp();
    const emptyTitle = await app.request("http://localhost/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "   " }),
    });
    expect(emptyTitle.status).toBe(400);

    const longTitle = await app.request("http://localhost/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "a".repeat(201) }),
    });
    expect(longTitle.status).toBe(400);

    const invalidId = await app.request("http://localhost/api/todos/zero", { method: "DELETE" });
    expect(invalidId.status).toBe(400);

    const missingCompleted = await app.request("http://localhost/api/todos/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(missingCompleted.status).toBe(400);

    const missingTodo = await app.request("http://localhost/api/todos/1", { method: "DELETE" });
    expect(missingTodo.status).toBe(404);
    await expect(missingTodo.json()).resolves.toEqual({ error: "Todo not found" });
  });
});
