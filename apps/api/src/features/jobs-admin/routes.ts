import {
  exampleJob,
  exampleJobSchema,
  JobBackendUnavailableError,
  type JobProducer,
} from "@full-stack-example/jobs";
import { zValidator } from "@hono/zod-validator";
import type { Env, Hono, MiddlewareHandler, Schema } from "hono";
import { createFactory } from "hono/factory";

const factory = createFactory();

export function setupExampleJobsApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: {
    readonly producer: JobProducer;
    readonly beforeAuthorization: readonly MiddlewareHandler[];
    readonly authorization: readonly MiddlewareHandler[];
  },
) {
  const route = factory.createApp();
  for (const middleware of options.beforeAuthorization) route.use("/examples", middleware);
  for (const middleware of options.authorization) route.use("/examples", middleware);
  route.post("/examples", zValidator("json", exampleJobSchema), async (context) => {
    try {
      const job = await options.producer.enqueue(exampleJob, context.req.valid("json"));
      return context.json({ jobId: job.id, queueName: job.queueName, name: job.name }, 202);
    } catch (error) {
      if (!(error instanceof JobBackendUnavailableError)) throw error;
      return context.json({ error: "Job backend unavailable" }, 503);
    }
  });
  return app.route("/admin/jobs", route);
}
