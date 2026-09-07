import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { ApplyGlobalResponse } from "hono/client";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import { requestId } from "hono/request-id";
import { createSystemModule } from "@full-stack-example/system";
import type { Logger } from "@full-stack-example/logging";
import { honoLogger } from "@logtape/hono";
import { trace } from "@opentelemetry/api";
import { httpInstrumentationMiddleware } from "@hono/otel";
import { appFactory } from "./factory.js";
import { createLogStreamRoute } from "./log-stream.js";
import type { LogStream } from "@full-stack-example/logging";

export function createApp(options: {
  readonly checkDatabase: () => Promise<void>;
  readonly logger: Logger;
  readonly webOrigin: string;
  readonly logStream?: LogStream;
  readonly logStreamHeartbeatMs?: number;
}) {
  const routes = appFactory
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
    .use("*", cors({ origin: options.webOrigin }))
    .use("*", secureHeaders())
    .use("*", bodyLimit({ maxSize: 1_048_576 }))
    .use("*", timeout(10_000))
    .notFound((context) => context.json({ error: "Not found" }, 404))
    .onError((_error, context) => {
      return context.json({ error: "Internal server error" }, 500);
    })
    .route(
      "/",
      createSystemModule({
        checkDatabase: options.checkDatabase,
        logger: options.logger.getChild("system"),
      }),
    );
  if (options.logStream) {
    routes.get(
      "/api/logs/stream",
      createLogStreamRoute({
        stream: options.logStream,
        heartbeatMs: options.logStreamHeartbeatMs ?? 15_000,
      }),
    );
  }
  return routes;
}

export type AppType = ApplyGlobalResponse<
  ReturnType<typeof createApp>,
  { 500: { json: { error: string } } }
>;
