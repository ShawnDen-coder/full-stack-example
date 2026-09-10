import type { Env, Hono, Schema } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";
import { healthResponseSchema } from "./schemas.js";
import { getHealth } from "./service.js";

export function setupSystemApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: {
    readonly checkDatabase: () => Promise<void>;
    readonly timeoutMs?: number;
    readonly onProbeFailure?: () => void;
  },
) {
  return app.get(
    "/health",
    describeRoute({
      operationId: "getHealth",
      tags: ["system"],
      summary: "Get service health",
      description: "Check whether the API can reach its PostgreSQL dependency.",
      security: [],
      responses: {
        200: {
          description: "The service is healthy.",
          content: { "application/json": { schema: resolver(healthResponseSchema) } },
        },
        503: {
          description: "The database health check is degraded.",
          content: { "application/json": { schema: resolver(healthResponseSchema) } },
        },
        500: {
          description: "Unexpected internal server error.",
          content: {
            "application/json": {
              schema: resolver(z.object({ error: z.literal("Internal server error") })),
            },
          },
        },
      },
    }),
    async (context) => {
      const health = await getHealth(options.checkDatabase, options.timeoutMs);
      context.header("Cache-Control", "no-store");
      if (health.status === "ok") return context.json(health, 200);
      options.onProbeFailure?.();
      return context.json(health, 503);
    },
  );
}
