import type { LogStream } from "@full-stack-example/logging";
import type { Env, Hono, MiddlewareHandler, Schema } from "hono";
import { appFactory } from "./factory.js";
import { createLogStreamHandlers } from "./log-stream.handler.js";

export interface LogStreamOptions {
  readonly stream: LogStream;
  readonly heartbeatMs: number;
  readonly authorization: readonly [MiddlewareHandler, MiddlewareHandler, MiddlewareHandler];
}

function createLogStreamRoutes(options: LogStreamOptions) {
  return appFactory.createApp().get("/", ...createLogStreamHandlers(options));
}

export function setupLogStreamApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: LogStreamOptions,
) {
  return app.route("/api/logs/stream", createLogStreamRoutes(options));
}
