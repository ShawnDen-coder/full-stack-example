import { streamSSE } from "hono/streaming";
import type { LogStream } from "@full-stack-example/logging";

export function createLogStreamRoute(options: {
  readonly stream: LogStream;
  readonly heartbeatMs: number;
}) {
  return async (context: {
    req: { header: (name: string) => string | undefined };
    header: (name: string, value: string) => void;
  }) => {
    context.header("Cache-Control", "no-cache, no-transform");
    context.header("X-Accel-Buffering", "no");
    const subscription = options.stream.subscribe(context.req.header("Last-Event-ID"));
    return streamSSE(context as never, async (stream) => {
      stream.onAbort(subscription.close);
      await stream.writeSSE({
        event: "ready",
        data: JSON.stringify({ latestId: options.stream.latestId() }),
        retry: 3000,
      });
      if (subscription.replay.truncated)
        await stream.writeSSE({
          event: "reset",
          data: JSON.stringify({ reason: "buffer-truncated" }),
        });
      for (const record of subscription.replay.records)
        await stream.writeSSE({ event: "log", id: record.id, data: JSON.stringify(record) });
      let pending = subscription.next();
      try {
        while (!stream.aborted) {
          const result = await Promise.race([
            pending.then((record) => ({ record })),
            new Promise<{ readonly heartbeat: true }>((resolve) =>
              setTimeout(() => resolve({ heartbeat: true }), options.heartbeatMs),
            ),
          ]);
          if (subscription.overflowed()) {
            await stream.writeSSE({
              event: "overflow",
              data: JSON.stringify({ reason: "slow-client" }),
            });
            return;
          }
          if ("heartbeat" in result) await stream.write(": heartbeat\n\n");
          else if (result.record) {
            await stream.writeSSE({
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
  };
}
