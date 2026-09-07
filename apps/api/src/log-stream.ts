import { streamSSE } from "hono/streaming";
import type { LogStream } from "@full-stack-example/logging";

export function createLogStreamRoute(options: {
  readonly stream: LogStream;
  readonly heartbeatMs: number;
}) {
  return async (context: { req: { header: (name: string) => string | undefined }; header: (name: string, value: string) => void }) => {
    context.header("Cache-Control", "no-cache, no-transform");
    context.header("X-Accel-Buffering", "no");
    const replay = options.stream.snapshotAfter(context.req.header("Last-Event-ID"));
    return streamSSE(context as never, async (stream) => {
      await stream.writeSSE({ event: "ready", data: JSON.stringify({ latestId: options.stream.latestId() }), retry: 3000 });
      if (replay.truncated) await stream.writeSSE({ event: "reset", data: JSON.stringify({ reason: "buffer-truncated" }) });
      for (const record of replay.records)
        await stream.writeSSE({ event: "log", id: record.id, data: JSON.stringify(record) });
      let unsubscribe: () => void = () => undefined;
      try {
        while (!stream.aborted) {
          const next = await new Promise<ReturnType<LogStream["snapshotAfter"]>["records"][number] | undefined>((resolve) => {
            const timer = setTimeout(() => resolve(undefined), options.heartbeatMs);
            unsubscribe = options.stream.subscribe((record) => {
              clearTimeout(timer);
              resolve(record);
            });
          });
          unsubscribe();
          if (next) await stream.writeSSE({ event: "log", id: next.id, data: JSON.stringify(next) });
          else await stream.write(": heartbeat\n\n");
        }
      } finally {
        unsubscribe();
      }
    });
  };
}
