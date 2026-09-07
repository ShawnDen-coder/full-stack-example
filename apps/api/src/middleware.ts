import type { Logger } from "pino";
import { appFactory } from "./factory.js";

export function requestLogging(logger: Logger) {
  return appFactory.createMiddleware(async (context, next) => {
    const requestId = context.get("requestId");
    const requestLogger = logger.child({ requestId });
    const startedAt = performance.now();
    context.set("logger", requestLogger);
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
  });
}
