import { Hono } from "hono";
import type { Logger } from "pino";
import { getHealth } from "./service.js";

export function createSystemModule(options: {
  readonly checkDatabase: () => Promise<void>;
  readonly logger: Logger;
}) {
  return new Hono().get("/health", async (context) => {
    const health = await getHealth(options.checkDatabase);
    if (health.status === "ok") return context.json(health, 200);
    options.logger.warn({ event: "system.health.degraded" }, "Database health check failed");
    return context.json(health, 503);
  });
}
