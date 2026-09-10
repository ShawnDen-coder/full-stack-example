import { type AuthModule, setupAuthApp } from "@full-stack-example/auth/server";
import type { Logger, LogStream } from "@full-stack-example/logging";
import { setupSystemApp } from "@full-stack-example/system";
import { setupTodosApp, type TenantTodoService } from "@full-stack-example/todos";
import { httpInstrumentationMiddleware } from "@hono/otel";
import { honoLogger } from "@logtape/hono";
import { trace } from "@opentelemetry/api";
import { bodyLimit } from "hono/body-limit";
import type { ApplyGlobalResponse } from "hono/client";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import { openAPIRouteHandler } from "hono-openapi";
import { appFactory } from "./factory.js";
import { setupLogStreamApp } from "./log-stream.js";
import { setupWebApp } from "./web-app.js";

export function createApp(options: {
  readonly checkDatabase: () => Promise<void>;
  readonly logger: Logger;
  readonly webOrigin: string;
  readonly todoService: TenantTodoService;
  readonly auth?: AuthModule;
  readonly logStream?: LogStream;
  readonly logStreamHeartbeatMs?: number;
  readonly webAssetsDirectory?: string;
}) {
  const app = appFactory
    .createApp()
    .use("*", httpInstrumentationMiddleware({ serviceName: "full-stack-example-api" }))
    .use("*", requestId({ limitLength: 128 }))
    .use(
      "*",
      honoLogger({
        category: ["full-stack-example", "api", "http"],
        format: (context, responseTime) => ({
          event: "http.request.completed",
          method: context.req.method,
          path: context.req.path,
          statusCode: context.res.status,
          durationMs: Math.round(responseTime),
        }),
        skip: (context) => context.req.path === "/health" && context.res.status < 400,
        context: {
          requestId: false,
          enrich: (context) => {
            const spanContext = trace.getActiveSpan()?.spanContext();
            return {
              requestId: context.get("requestId"),
              ...(spanContext?.traceId
                ? { traceId: spanContext.traceId, spanId: spanContext.spanId }
                : {}),
            };
          },
        },
      }),
    )
    .use("*", cors({ origin: options.webOrigin, credentials: true }))
    .use("*", secureHeaders())
    .use("*", bodyLimit({ maxSize: 1_048_576 }))
    .use("*", timeout(10_000));
  const withOpenApi = app.get(
    "/openapi.json",
    openAPIRouteHandler(app, {
      documentation: {
        openapi: "3.1.0",
        info: {
          title: "Full Stack Example API",
          version: "0.1.0",
          description: "HTTP API for health checks and todo management.",
        },
        servers: [{ url: "http://localhost:3000", description: "Local development" }],
      },
      exclude: [/^\/api\/logs\/stream$/, /^\/openapi\.json$/],
    }),
  );
  const withErrors = withOpenApi
    .notFound((context) => context.json({ error: "Not found" }, 404))
    .onError((_error, context) => context.json({ error: "Internal server error" }, 500));
  const withSystem = setupSystemApp(withErrors, {
    checkDatabase: options.checkDatabase,
    onProbeFailure: () =>
      options.logger
        .getChild("system")
        .warn("Database health check failed", { event: "system.health.degraded" }),
  });

  const withAuth = options.auth ? setupAuthApp(withSystem, { auth: options.auth }) : withSystem;
  const withTenantTodos = options.auth
    ? withAuth.use("/api/todos*", options.auth.require.requireTenant)
    : withAuth;
  const allowWithoutAuth = async (_context: import("hono").Context, next: import("hono").Next) =>
    next();
  const withTodos = setupTodosApp(withTenantTodos, {
    service: options.todoService,
    authorization: {
      read: options.auth
        ? options.auth.require.requireTenantPermission({ resource: "todos", action: "read" })
        : allowWithoutAuth,
      write: options.auth
        ? options.auth.require.requireTenantPermission({ resource: "todos", action: "write" })
        : allowWithoutAuth,
      delete: options.auth
        ? options.auth.require.requireTenantPermission({ resource: "todos", action: "delete" })
        : allowWithoutAuth,
    },
    getTenantId: (context) =>
      (context.get("tenantPrincipal") as { readonly tenantId?: string } | undefined)?.tenantId,
  });
  const withLogStream = setupLogStreamApp(withTodos, {
    stream: options.logStream,
    heartbeatMs: options.logStreamHeartbeatMs ?? 15_000,
  });
  return setupWebApp(withLogStream, { assetsDirectory: options.webAssetsDirectory });
}

export type AppType = ApplyGlobalResponse<
  ReturnType<typeof createApp>,
  { 500: { json: { error: string } } }
>;
