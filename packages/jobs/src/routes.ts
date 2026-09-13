import { zValidator } from "@hono/zod-validator";
import type { Env, Hono, Schema } from "hono";
import { createFactory } from "hono/factory";
import type { JobService } from "./contracts.js";
import { exampleJobSchema } from "./schemas.js";
import { JobBackendUnavailableError } from "./service.js";

const factory = createFactory<{ Variables: Record<string, never> }>();

export function setupJobsApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: {
    readonly service: JobService;
    readonly beforeAuthorization?: readonly import("hono").MiddlewareHandler[];
    readonly authorization?: readonly import("hono").MiddlewareHandler[];
  },
) {
  const route = factory.createApp();
  for (const middleware of options.beforeAuthorization ?? []) route.use("/examples", middleware);
  for (const middleware of options.authorization ?? []) route.use("/examples", middleware);
  route.post("/examples", zValidator("json", exampleJobSchema), async (context) => {
    try {
      const job = await options.service.enqueueExample(context.req.valid("json"));
      return context.json({ jobId: job.id, queueName: job.queueName, name: job.name }, 202);
    } catch (error) {
      if (!(error instanceof JobBackendUnavailableError)) throw error;
      return context.json({ error: "Job backend unavailable" }, 503);
    }
  });
  return app.route("/api/admin/jobs", route);
}

export const setupJobsApi = setupJobsApp;
