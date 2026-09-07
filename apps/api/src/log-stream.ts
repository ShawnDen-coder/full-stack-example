import type { LogStream } from "@full-stack-example/logging";
import type { Env, Hono, Schema } from "hono";
import { streamSSE } from "hono/streaming";

export function setupLogStreamApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: { readonly stream: LogStream | undefined; readonly heartbeatMs: number },
) {
  return app.get("/api/logs/stream", async (context) => {
    if (!options.stream) return context.notFound();
    const stream = options.stream;
    const requestContext: {
      req: { header: (name: string) => string | undefined };
      header: (name: string, value: string) => void;
    } = context;
    requestContext.header("Cache-Control", "no-cache, no-transform");
    requestContext.header("X-Accel-Buffering", "no");
    const subscription = stream.subscribe(requestContext.req.header("Last-Event-ID"));
    return streamSSE(context, async (streaming) => {
      streaming.onAbort(subscription.close);
      await streaming.writeSSE({
        event: "ready",
        data: JSON.stringify({ latestId: stream.latestId() }),
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
