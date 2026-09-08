import type { Logger, LogStream } from "@full-stack-example/logging";
import { setupSystemApp } from "@full-stack-example/system";
import { setupTodosApp, type TodoService } from "@full-stack-example/todos";
import { httpInstrumentationMiddleware } from "@hono/otel";
import { honoLogger } from "@logtape/hono";
import { trace } from "@opentelemetry/api";
import { bodyLimit } from "hono/body-limit";
import type { ApplyGlobalResponse } from "hono/client";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import { appFactory } from "./factory.js";
import { setupLogStreamApp } from "./log-stream.js";
import { setupWebApp } from "./web-app.js";
import { createOpenApiDocument } from "./openapi.js";

export function createApp(options: {
  readonly checkDatabase: () => Promise<void>;
  readonly logger: Logger;
  readonly webOrigin: string;
  readonly todoService: TodoService;
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
    .use("*", timeout(10_000))
    .get("/openapi.json", (context) => context.json(createOpenApiDocument()))
    .notFound((context) => context.json({ error: "Not found" }, 404))
    .onError((_error, context) => context.json({ error: "Internal server error" }, 500));
  const withSystem = setupSystemApp(app, {
    checkDatabase: options.checkDatabase,
    logger: options.logger.getChild("system"),
  });
  const withTodos = setupTodosApp(withSystem, { service: options.todoService });
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
