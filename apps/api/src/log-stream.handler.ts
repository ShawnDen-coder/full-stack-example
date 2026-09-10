import type { LogStream } from "@full-stack-example/logging";
import type { MiddlewareHandler } from "hono";
import { streamSSE } from "hono/streaming";
import { describeRoute } from "hono-openapi";
import { appFactory } from "./factory.js";
import { logStreamDescription } from "./log-stream.desc.js";

export function createLogStreamHandlers(options: {
  readonly stream: LogStream;
  readonly heartbeatMs: number;
  readonly authorization: readonly [MiddlewareHandler, MiddlewareHandler, MiddlewareHandler];
}) {
  return appFactory.createHandlers(
    describeRoute(logStreamDescription),
    ...options.authorization,
    async (context) => {
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
    },
  );
}
