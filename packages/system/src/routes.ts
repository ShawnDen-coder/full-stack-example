import { Hono } from "hono";
import type { Logger } from "@full-stack-example/logging";
import { getHealth } from "./service.js";

export function createSystemModule(options: {
  readonly checkDatabase: () => Promise<void>;
  readonly logger: Logger;
}) {
  return new Hono().get("/health", async (context) => {
    const health = await getHealth(options.checkDatabase);
    context.header("Cache-Control", "no-store");
    if (health.status === "ok") return context.json(health, 200);
    options.logger.warn("Database health check failed", { event: "system.health.degraded" });
    return context.json(health, 503);
  });
}
