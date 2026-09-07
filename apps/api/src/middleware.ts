import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import type { MiddlewareHandler } from "hono";

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestLogging(logger: Logger): MiddlewareHandler {
  return async (context, next) => {
    const requestIdHeader = context.req.header("X-Request-ID");
    const requestId =
      requestIdHeader && requestIdPattern.test(requestIdHeader) ? requestIdHeader : randomUUID();
    const requestLogger = logger.child({ requestId });
    const startedAt = performance.now();
    context.set("logger", requestLogger);
    context.header("X-Request-ID", requestId);
    try {
      await next();
      const statusCode = context.res.status;
      const fields = {
        event: statusCode >= 500 ? "http.request.failed" : "http.request.completed",
        requestId,
        method: context.req.method,
        path: new URL(context.req.url).pathname,
        statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      };
      if (statusCode >= 500) requestLogger.error(fields, "Request failed");
      else if (statusCode >= 400) requestLogger.warn(fields, "Request completed");
      else if (new URL(context.req.url).pathname === "/health")
        requestLogger.debug(fields, "Request completed");
      else requestLogger.info(fields, "Request completed");
    } catch (error) {
      requestLogger.error(
        { err: error, event: "http.request.failed", requestId },
        "Request failed",
      );
      throw error;
    }
  };
}
