import type { Logger } from "@full-stack-example/logging";
import { httpInstrumentationMiddleware } from "@hono/otel";
import { honoLogger } from "@logtape/hono";
import { trace } from "@opentelemetry/api";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import { appFactory } from "./factory.js";

export interface HttpOptions {
  readonly logger: Logger;
  readonly webOrigin: string;
}

export function createHttpApp(options: HttpOptions) {
  return appFactory
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
}
