import { JobBackendUnavailableError } from "@full-stack-example/jobs";
import type { JobProducer, JobsBoardSource } from "@full-stack-example/jobs/contracts";
import { configureLogging, createLogStream, getAppLogger } from "@full-stack-example/logging";
import type { MiddlewareHandler } from "hono";
import { beforeAll, describe, expect, it } from "vitest";
import { type CreateAppOptions, createApp } from "../src/app.js";

const logger = getAppLogger("jobs-test");
const logStream = createLogStream();
const enqueue = async () => ({ id: "job-1", name: "progress-demo", queueName: "examples" });
const jobProducer = { enqueue } as unknown as JobProducer;
const board = {
  queue: {
    name: "examples",
    metaValues: { version: "bullmq" },
  },
} as JobsBoardSource;

function createTestApp(boardEnabled = false, producer: JobProducer = jobProducer) {
  const requireSession: MiddlewareHandler = async (context, next) => {
    if (!context.req.header("x-session")) return context.json({ error: "Unauthorized" }, 401);
    (context as unknown as { set(key: string, value: unknown): void }).set("sessionPrincipal", {
      userId: "user-1",
    });
    return next();
  };
  const requirePlatformAdmin: MiddlewareHandler = async (context, next) =>
    context.req.header("x-admin") ? next() : context.json({ error: "Forbidden" }, 403);
  const requireFreshSession: MiddlewareHandler = async (context, next) =>
    context.req.header("x-fresh") ? next() : context.json({ error: "Forbidden" }, 403);
  const pass: MiddlewareHandler = async (_context, next) => next();
  return createApp({
    logger,
    http: { webOrigin: "http://localhost:5173" },
    documentation: { enabled: false },
    modules: {
      system: { checkDatabase: async () => undefined },
      todos: {
        service: {
          listTodos: async () => [],
          createTodo: async () => ({ id: 1, title: "", completed: false }),
          updateTodo: async () => undefined,
          deleteTodo: async () => false,
        },
      },
      auth: {
        require: {
          requireSession,
          requirePlatformAdmin,
          requireFreshSession,
          requireTenantPermission: () => pass,
        },
        auth: { handler: async () => new Response("handled") },
      } as unknown as NonNullable<CreateAppOptions["modules"]["auth"]>,
      jobs: { producer, board, boardEnabled },
    },
    web: {},
  });
}

beforeAll(async () => {
  await configureLogging({
    service: "jobs-test",
    environment: "test",
    level: "info",
    pretty: false,
    stream: logStream,
  });
});

describe("jobs API composition", () => {
  it("enforces session, platform-admin, and fresh-session authorization", async () => {
    const app = createTestApp();
    const request = (headers: Record<string, string> = {}) =>
      app.request("http://localhost/api/admin/jobs/examples", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
          ...headers,
        },
        body: JSON.stringify({ message: "hello", stepDelayMs: 0 }),
      });

    expect((await request()).status).toBe(401);
    expect((await request({ "x-session": "1" })).status).toBe(403);
    expect((await request({ "x-session": "1", "x-admin": "1" })).status).toBe(403);
    expect((await request({ "x-session": "1", "x-admin": "1", "x-fresh": "1" })).status).toBe(202);
  });

  it("rejects cross-origin job writes", async () => {
    const app = createTestApp();
    const response = await app.request("http://localhost/api/admin/jobs/examples", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
        "x-session": "1",
        "x-admin": "1",
        "x-fresh": "1",
      },
      body: JSON.stringify({ message: "hello" }),
    });

    expect(response.status).toBe(403);
  });

  it("audits denied and successful writes with request and actor metadata", async () => {
    const app = createTestApp();
    const request = (headers: Record<string, string> = {}) =>
      app.request("http://localhost/api/admin/jobs/examples", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
          "X-Request-ID": "jobs-audit-test",
          ...headers,
        },
        body: JSON.stringify({ message: "hello", stepDelayMs: 0 }),
      });

    expect((await request()).status).toBe(401);
    expect((await request({ "x-session": "1" })).status).toBe(403);
    expect((await request({ "x-session": "1", "x-admin": "1" })).status).toBe(403);
    expect(
      (
        await request({
          "x-session": "1",
          "x-admin": "1",
          "x-fresh": "1",
          Origin: "https://attacker.example",
        })
      ).status,
    ).toBe(403);
    expect((await request({ "x-session": "1", "x-admin": "1", "x-fresh": "1" })).status).toBe(202);

    const events = logStream
      .subscribe()
      .replay.records.filter(
        (record) =>
          record.properties.event === "jobs.mutation" &&
          record.properties.requestId === "jobs-audit-test",
      );
    expect(events.map((event) => event.properties.status)).toEqual([401, 403, 403, 403, 202]);
    expect(events.at(-1)?.properties).toMatchObject({
      event: "jobs.mutation",
      method: "POST",
      path: "/api/admin/jobs/examples",
      actorUserId: "user-1",
      requestId: "jobs-audit-test",
      durationMs: expect.any(Number),
      jobResource: "examples",
    });
    expect(events.at(-1)?.properties).not.toHaveProperty("jobId");
  });

  it("audits handler exceptions as 500 responses", async () => {
    const app = createTestApp(false, {
      enqueue: async () => {
        throw new Error("simulated queue failure");
      },
    });
    const response = await app.request("http://localhost/api/admin/jobs/examples", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
        "X-Request-ID": "jobs-audit-error-test",
        "x-session": "1",
        "x-admin": "1",
        "x-fresh": "1",
      },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(response.status).toBe(500);
    const events = logStream
      .subscribe()
      .replay.records.filter(
        (record) =>
          record.properties.event === "jobs.mutation" &&
          record.properties.requestId === "jobs-audit-error-test",
      );
    expect(events[0]?.properties.status).toBe(500);
  });

  it("returns 503 when the queue backend is unavailable", async () => {
    const app = createTestApp(false, {
      enqueue: async () => {
        throw new JobBackendUnavailableError(new Error("database unavailable"));
      },
    } as unknown as JobProducer);
    const response = await app.request("http://localhost/api/admin/jobs/examples", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
        "x-session": "1",
        "x-admin": "1",
        "x-fresh": "1",
      },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Job backend unavailable" });
  });

  it("validates example payloads at the API boundary", async () => {
    const app = createTestApp();
    const response = await app.request("http://localhost/api/admin/jobs/examples", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
        "x-session": "1",
        "x-admin": "1",
        "x-fresh": "1",
      },
      body: JSON.stringify({ message: "  " }),
    });
    expect(response.status).toBe(400);
  });

  it("audits Bull Board writes rejected by its CSRF guard", async () => {
    const app = createTestApp(true);
    const response = await app.request(
      "http://localhost/admin/queues/api/queues/examples/jobs/job-1/retry",
      {
        method: "POST",
        headers: {
          Origin: "https://attacker.example",
          "X-Request-ID": "bull-board-audit-test",
        },
      },
    );

    expect(response.status).toBe(403);
    const events = logStream
      .subscribe()
      .replay.records.filter(
        (record) =>
          record.properties.event === "jobs.mutation" &&
          record.properties.requestId === "bull-board-audit-test",
      );
    expect(events).toHaveLength(1);
    expect(events[0]?.properties).toMatchObject({
      method: "POST",
      path: "/admin/queues/api/queues/examples/jobs/job-1/retry",
      status: 403,
      queueName: "examples",
      jobId: "job-1",
    });
  });

  it("rejects jobs configuration without authentication at runtime", () => {
    expect(() =>
      createApp({
        logger,
        http: { webOrigin: "http://localhost:5173" },
        documentation: { enabled: false },
        modules: {
          system: { checkDatabase: async () => undefined },
          todos: {
            service: {
              listTodos: async () => [],
              createTodo: async () => ({ id: 1, title: "", completed: false }),
              updateTodo: async () => undefined,
              deleteTodo: async () => false,
            },
          },
          jobs: { producer: jobProducer, board },
        },
        web: {},
      } as unknown as CreateAppOptions),
    ).toThrow("The API requires an authentication module");
  });
});
