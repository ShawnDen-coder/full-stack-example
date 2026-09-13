import { createHmac } from "node:crypto";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Queue } from "bullmq";
import type { Env, Hono, Schema } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { JobsBoardSource } from "./contracts.js";

const sensitiveKey = /password|secret|token|authorization|cookie/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redact(nested),
    ]),
  );
}

export function setupJobsBoard<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: {
    readonly board: JobsBoardSource;
    readonly beforeMiddleware?: readonly import("hono").MiddlewareHandler[];
    readonly authorization?: readonly import("hono").MiddlewareHandler[];
    readonly basePath?: string;
    readonly environment: string;
    readonly csrfSecret: string;
    readonly secureCookies?: boolean;
    readonly allowedOrigins: readonly string[];
  },
) {
  const adapter = new HonoAdapter(serveStatic);
  const basePath = options.basePath ?? "/admin/queues";
  adapter.setBasePath(basePath);
  const csrfToken = createHmac("sha256", options.csrfSecret).update("bull-board").digest("hex");
  const queue = options.board.queue as Queue;
  const queueAdapter = new BullMQAdapter(queue);
  queueAdapter.setFormatter("data", redact);
  queueAdapter.setFormatter("returnValue", redact);
  createBullBoard({
    queues: [queueAdapter],
    serverAdapter: adapter,
    options: {
      uiConfig: {
        boardTitle: "Full Stack Example · Jobs",
        pollingInterval: { forceInterval: 10 },
        environment: {
          label: options.environment,
          color: options.environment === "production" ? "#ef4444" : "#3b82f6",
          textColor: "#ffffff",
        },
      },
    },
  });
  const csrfMiddleware: import("hono").MiddlewareHandler = async (context, next) => {
    setCookie(context, "XSRF-TOKEN", csrfToken, {
      httpOnly: false,
      path: basePath,
      sameSite: "Lax",
      secure: options.secureCookies ?? options.environment === "production",
    });
    if (!["GET", "HEAD", "OPTIONS"].includes(context.req.method)) {
      const origin = context.req.header("Origin");
      if (!origin || !options.allowedOrigins.includes(origin))
        return context.json({ error: "CSRF validation failed" }, 403);
      const cookieToken = getCookie(context, "XSRF-TOKEN");
      const headerToken = context.req.header("x-xsrf-token");
      if (cookieToken !== csrfToken || headerToken !== csrfToken)
        return context.json({ error: "CSRF validation failed" }, 403);
    }
    return next();
  };
  for (const middleware of options.beforeMiddleware ?? []) {
    app.use(basePath, middleware);
    app.use(`${basePath}/*`, middleware);
  }
  app.use(basePath, csrfMiddleware);
  app.use(`${basePath}/*`, csrfMiddleware);
  for (const middleware of options.authorization ?? []) {
    app.use(basePath, middleware);
    app.use(`${basePath}/*`, middleware);
  }
  return app.route(basePath, adapter.registerPlugin());
}
