import { setupJobsBoard } from "@full-stack-example/jobs/server";
import type { Env, Hono, Schema } from "hono";
import { createJobsAdminPolicy } from "./policy.js";
import type { JobsBoardOptions } from "./setup.js";

export function setupJobsBoardApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: JobsBoardOptions,
) {
  const policy = createJobsAdminPolicy({
    logger: options.logger,
    policies: options.policies,
  });
  return setupJobsBoard(app, {
    board: options.board,
    environment: options.environment,
    ...(options.basePath ? { basePath: options.basePath } : {}),
    authorization: policy.boardAuthorization,
    beforeMiddleware: policy.beforeAuthorization,
    csrfSecret: options.csrfSecret,
    allowedOrigins: options.allowedOrigins,
  });
}
