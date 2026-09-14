import type { LogStream } from "@full-stack-example/logging";
import type { Env, Hono, MiddlewareHandler, Schema } from "hono";
import { streamSSE } from "hono/streaming";
import { type DescribeRouteOptions, describeRoute } from "hono-openapi";
import { appFactory } from "../../app/env.js";

const logStreamDescription: DescribeRouteOptions = {
  operationId: "streamLogs",
  tags: ["Diagnostics"],
  summary: "Stream application logs",
  description:
    "Open a long-lived Server-Sent Events stream for redacted diagnostic logs. Swagger Try it out keeps this request open.",
  parameters: [
    {
      in: "header",
      name: "Last-Event-ID",
      required: false,
      schema: { type: "string" },
      description: "Resume replay after this event ID when it is still buffered.",
    },
  ],
  responses: {
    200: {
      description:
        "SSE stream containing ready, log, reset, and overflow events with periodic heartbeat comments.",
      content: { "text/event-stream": { schema: { type: "string" } } },
    },
    401: { description: "A valid Better Auth session is required." },
    403: { description: "A fresh platform-admin session is required." },
    500: { description: "Unexpected internal server error." },
  },
};

export interface LogStreamOptions {
  readonly stream: LogStream;
  readonly heartbeatMs: number;
  readonly authorization: readonly [MiddlewareHandler, MiddlewareHandler, MiddlewareHandler];
}

function createLogStreamRoutes(options: LogStreamOptions) {
  return appFactory
    .createApp()
    .get("/", describeRoute(logStreamDescription), ...options.authorization, async (context) => {
      const subscription = options.stream.subscribe(context.req.header("Last-Event-ID"));
      context.header("Cache-Control", "no-cache, no-transform");
      context.header("X-Accel-Buffering", "no");
      return streamSSE(context, async (streaming) => {
        streaming.onAbort(subscription.close);
        await streaming.writeSSE({
          event: "ready",
          data: JSON.stringify({ latestId: options.stream.latestId() }),
          retry: 3000,
        });
        if (subscription.replay.truncated)
          await streaming.writeSSE({
            event: "reset",
            data: JSON.stringify({ reason: "buffer-truncated" }),
          });
        for (const record of subscription.replay.records)
          await streaming.writeSSE({ event: "log", id: record.id, data: JSON.stringify(record) });
        let pending = subscription.next();
        try {
          while (!streaming.aborted) {
            const result = await Promise.race([
              pending.then((record) => ({ record })),
              new Promise<{ readonly heartbeat: true }>((resolve) =>
                setTimeout(() => resolve({ heartbeat: true }), options.heartbeatMs),
              ),
            ]);
            if (subscription.overflowed()) {
              await streaming.writeSSE({
                event: "overflow",
                data: JSON.stringify({ reason: "slow-client" }),
              });
              return;
            }
            if ("heartbeat" in result) await streaming.write(": heartbeat\n\n");
            else if (result.record) {
              await streaming.writeSSE({
                event: "log",
                id: result.record.id,
                data: JSON.stringify(result.record),
              });
              pending = subscription.next();
            } else return;
          }
        } finally {
          subscription.close();
        }
      });
    });
}

export function setupLogStreamApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: LogStreamOptions,
) {
  return app.route("/logs/stream", createLogStreamRoutes(options));
}
