import { configureLogging, getAppLogger } from "@full-stack-example/logging";
import type { TodoService } from "@full-stack-example/todos";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

let logger = getAppLogger("test");
const todoService: TodoService = {
  listTodos: async () => [],
  createTodo: async (input) => ({ id: 1, title: input.title, completed: false }),
  updateTodo: async ({ id, completed }) => ({ id, title: "Todo", completed }),
  deleteTodo: async () => true,
};

beforeAll(async () => {
  await configureLogging({ service: "test", environment: "test", level: "silent", pretty: false });
  logger = getAppLogger("test");
});

describe("API", () => {
  it("returns the health contract when the database is available", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      services: { database: { status: "up" } },
    });
  });

  it("serves an OpenAPI 3.1 document from the composed routes", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/openapi.json");
    expect(response.status).toBe(200);
    const document = await response.json();
    expect(document).toMatchObject({
      openapi: "3.1.0",
      paths: {
        "/health": { get: { operationId: "getHealth" } },
        "/api/todos": {
          get: { operationId: "listTodos" },
          post: { operationId: "createTodo" },
        },
        "/api/todos/{id}": {
          patch: { operationId: "updateTodo" },
          delete: { operationId: "deleteTodo" },
        },
      },
    });
  });

  it("documents and enforces Todo input validation", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false });
  });

  it("requires a tenant before serving Todo routes", async () => {
    const auth = {
      guards: {
        requireTenant: async (context: any, next: any) => context.json({ error: "Unauthorized" }, 401),
      },
      auth: { handler: async () => new Response("handled") },
    } as any;
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      auth,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/api/todos");
    expect(response.status).toBe(401);
  });

  it("returns a degradation without revealing the database error", async () => {
    const app = createApp({
      checkDatabase: async () => {
        throw new Error("postgres password");
      },
      logger,
      todoService,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/health");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("postgres password");
  });

  it("returns a uniform 404 response", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/unknown");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("serves production web assets and preserves API 404 responses", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      webOrigin: "http://localhost:3000",
      webAssetsDirectory: "apps/api/tests/fixtures/web",
    });

    const indexResponse = await app.request("http://localhost/dashboard");
    expect(indexResponse.status).toBe(200);
    expect(indexResponse.headers.get("Cache-Control")).toBe("no-cache");
    expect(await indexResponse.text()).toContain("test application");

    const assetResponse = await app.request("http://localhost/assets/app.js");
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");

    const apiResponse = await app.request("http://localhost/api/unknown");
    expect(apiResponse.status).toBe(404);
    expect(apiResponse.headers.get("Content-Type")).toContain("application/json");
  });

  it("does not use the SPA fallback for unsupported methods", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      webOrigin: "http://localhost:3000",
      webAssetsDirectory: "apps/api/tests/fixtures/web",
    });
    const response = await app.request("http://localhost/dashboard", { method: "POST" });
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });

  it("allows credentialed requests from the configured web origin", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/health", {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("preserves a valid inbound request ID", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/health", {
      headers: { "X-Request-ID": "upstream-trace-123" },
    });
    expect(response.headers.get("X-Request-ID")).toBe("upstream-trace-123");
  });

  it("replaces an invalid inbound request ID", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/health", {
      headers: { "X-Request-ID": "invalid request id" },
    });
    expect(response.headers.get("X-Request-ID")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
  });
});
