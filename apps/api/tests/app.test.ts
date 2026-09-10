import { configureLogging, createLogStream, getAppLogger } from "@full-stack-example/logging";
import type { TenantTodoService } from "@full-stack-example/todos";
import { beforeAll, describe, expect, it } from "vitest";
import { type CreateAppOptions, createApp as createComposedApp } from "../src/app.js";

let logger = getAppLogger("test");
const todoService: TenantTodoService = {
  listTodos: async () => [],
  createTodo: async (_tenantId: string, input: { title: string }) => ({
    id: 1,
    title: input.title,
    completed: false,
  }),
  updateTodo: async (_tenantId: string, { id, completed }: { id: number; completed: boolean }) => ({
    id,
    title: "Todo",
    completed,
  }),
  deleteTodo: async () => true,
};

function createApp(options: {
  readonly checkDatabase: () => Promise<void>;
  readonly logger: typeof logger;
  readonly todoService: TenantTodoService;
  readonly webOrigin: string;
  readonly auth?: CreateAppOptions["modules"]["auth"];
  readonly webAssetsDirectory?: string;
  readonly documentationEnabled?: boolean;
  readonly logStream?: boolean;
}) {
  const auth = options.auth;
  const base = {
    system: { checkDatabase: options.checkDatabase },
    todos: { service: options.todoService },
  };
  const modules = auth
    ? {
        ...base,
        auth,
        ...(options.logStream ? { logStream: { stream: createLogStream(), heartbeatMs: 10 } } : {}),
      }
    : base;
  return createComposedApp({
    logger: options.logger,
    http: { webOrigin: options.webOrigin },
    documentation: { enabled: options.documentationEnabled ?? true },
    modules,
    web: { ...(options.webAssetsDirectory ? { assetsDirectory: options.webAssetsDirectory } : {}) },
  });
}

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
    const document = (await response.json()) as { readonly paths: Record<string, unknown> };
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
    expect(document.paths).not.toHaveProperty("/docs");
    expect(document.paths).not.toHaveProperty("/openapi.json");
  });

  it("serves Swagger UI with the same-origin OpenAPI document", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      webOrigin: "http://localhost:5173",
    });
    const response = await app.request("http://localhost/docs");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("url: '/openapi.json'");
    expect(html).toContain("withCredentials: true");
  });

  it("merges the selected Better Auth endpoints and marks protected operations", async () => {
    const auth = {
      auth: { handler: async () => new Response("handled") },
      require: {
        requireTenantPermission:
          () => async (_context: import("hono").Context, next: import("hono").Next) =>
            next(),
        requireSession: async (_context: import("hono").Context, next: import("hono").Next) =>
          next(),
        requirePlatformAdmin: async (_context: import("hono").Context, next: import("hono").Next) =>
          next(),
        requireFreshSession: async (_context: import("hono").Context, next: import("hono").Next) =>
          next(),
      },
      platform: {},
      getOpenApiDocument: async () => ({
        components: { securitySchemes: { apiKeyCookie: { type: "apiKey", in: "cookie" } } },
        paths: {
          "/api/auth/sign-in/email": { post: { operationId: "signInEmail", security: [] } },
          "/api/auth/sign-out": {
            post: { operationId: "signOut", security: [{ apiKeyCookie: [] }] },
          },
        },
      }),
    } as any;
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      auth,
      webOrigin: "http://localhost:5173",
    });
    const document = (await (await app.request("http://localhost/openapi.json")).json()) as any;
    expect(document.components.securitySchemes.apiKeyCookie).toEqual({
      type: "apiKey",
      in: "cookie",
    });
    expect(document.security).toEqual([{ apiKeyCookie: [] }]);
    expect(document.paths["/api/auth/sign-in/email"].post.security).toEqual([]);
    expect(document.paths["/api/auth/sign-out"].post.security).toEqual([{ apiKeyCookie: [] }]);
    expect(document.paths["/api/todos"].get.security).toBeUndefined();
    expect(document.paths["/health"].get.security).toEqual([]);
    for (const path of Object.values(document.paths) as Array<{ readonly security?: unknown }>)
      expect(path.security).toBeUndefined();
    expect(document.components.securitySchemes.bearerAuth).toBeUndefined();
    expect(document.paths["/api/platform/users"].post.operationId).toBe("createPlatformUser");
    expect(document.paths["/api/platform/organizations"].post.operationId).toBe(
      "createPlatformOrganization",
    );
    expect(document.paths["/api/platform/organizations/{id}/status"].patch.operationId).toBe(
      "setOrganizationStatus",
    );
    expect(document.paths["/api/platform/users/{id}/password-reset"].post.operationId).toBe(
      "requestPlatformPasswordReset",
    );
  });

  it("does not register API documentation when disabled", async () => {
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      webOrigin: "http://localhost:5173",
      documentationEnabled: false,
    });
    expect((await app.request("http://localhost/docs")).status).toBe(404);
    expect((await app.request("http://localhost/openapi.json")).status).toBe(404);
    expect((await app.request("http://localhost/api/logs/stream")).status).toBe(404);
  });

  it("protects and documents the log stream only when enabled with auth", async () => {
    const auth = {
      auth: { handler: async () => new Response("handled") },
      require: {
        requireTenantPermission:
          () => async (_context: import("hono").Context, next: import("hono").Next) =>
            next(),
        requireSession: async (context: import("hono").Context, next: import("hono").Next) =>
          context.req.header("x-session") ? next() : context.json({ error: "Unauthorized" }, 401),
        requirePlatformAdmin: async (context: import("hono").Context, next: import("hono").Next) =>
          context.req.header("x-admin") ? next() : context.json({ error: "Forbidden" }, 403),
        requireFreshSession: async (context: import("hono").Context, next: import("hono").Next) =>
          context.req.header("x-fresh") ? next() : context.json({ error: "Forbidden" }, 403),
      },
      platform: {},
      getOpenApiDocument: async () => ({
        components: { securitySchemes: { apiKeyCookie: { type: "apiKey", in: "cookie" } } },
        paths: {},
      }),
    } as any;
    const app = createApp({
      checkDatabase: async () => undefined,
      logger,
      todoService,
      auth,
      logStream: true,
      webOrigin: "http://localhost:5173",
    });

    expect((await app.request("http://localhost/api/logs/stream")).status).toBe(401);
    expect(
      (
        await app.request("http://localhost/api/logs/stream", {
          headers: { "x-session": "1" },
        })
      ).status,
    ).toBe(403);
    const response = await app.request("http://localhost/api/logs/stream", {
      headers: { "x-session": "1", "x-admin": "1", "x-fresh": "1" },
    });
    expect(response.status).toBe(200);
    await response.body?.cancel();

    const document = (await (await app.request("http://localhost/openapi.json")).json()) as any;
    expect(document.paths["/api/logs/stream"].get.tags).toEqual(["Diagnostics"]);
    expect(document.paths["/api/logs/stream"].get.security).toBeUndefined();
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
      require: {
        requireTenant: async (context: any, _next: any) =>
          context.json({ error: "Unauthorized" }, 401),
        requireTenantPermission: () => async (context: any) =>
          context.json({ error: "Unauthorized" }, 401),
        requireSession: async (_context: any, next: any) => next(),
        requirePlatformAdmin: async (_context: any, next: any) => next(),
        requireFreshSession: async (_context: any, next: any) => next(),
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

    const docsResponse = await app.request("http://localhost/docs");
    expect(docsResponse.status).toBe(200);
    await expect(docsResponse.text()).resolves.toContain("swagger-ui");
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
