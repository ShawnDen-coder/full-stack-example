import type { Logger } from "@full-stack-example/logging";
import type { Env, Hono, Schema } from "hono";
import { getHealth } from "./service.js";

export function setupSystemApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: {
    readonly checkDatabase: () => Promise<void>;
    readonly logger: Logger;
  },
) {
  return app.get("/health", async (context) => {
    const health = await getHealth(options.checkDatabase);
    context.header("Cache-Control", "no-store");
    if (health.status === "ok") return context.json(health, 200);
    options.logger.warn("Database health check failed", { event: "system.health.degraded" });
    return context.json(health, 503);
  });
}
