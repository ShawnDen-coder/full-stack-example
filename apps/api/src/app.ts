import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import { createSystemModule } from "@full-stack-example/system";
import type { Logger } from "pino";
import { requestLogging } from "./middleware.js";

export function createApp(options: {
  readonly checkDatabase: () => Promise<void>;
  readonly logger: Logger;
  readonly webOrigin: string;
}) {
  const routes = new Hono<{ Variables: { logger: Logger } }>()
    .use("*", requestLogging(options.logger))
    .use("*", cors({ origin: options.webOrigin }))
    .use("*", secureHeaders())
    .use("*", bodyLimit({ maxSize: 1_048_576 }))
    .use("*", timeout(10_000))
    .notFound((context) => context.json({ error: "Not found" }, 404))
    .onError((error, context) => {
      context
        .get("logger")
        ?.error({ err: error, event: "http.request.failed" }, "Unhandled request error");
      return context.json({ error: "Internal server error" }, 500);
    })
    .route(
      "/",
      createSystemModule({
        checkDatabase: options.checkDatabase,
        logger: options.logger.child({ component: "system" }),
      }),
    );
  return routes;
}

export type AppType = ReturnType<typeof createApp>;
