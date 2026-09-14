import type { JobProducer, JobsBoardSource } from "@full-stack-example/jobs/contracts";
import { setupJobsBoard } from "@full-stack-example/jobs/server";
import type { Logger } from "@full-stack-example/logging";
import type { Env, Hono, Schema } from "hono";
import type { AppPolicies } from "../../app/policies.js";
import { createJobsAdminPolicy } from "./policy.js";
import { setupExampleJobsApp } from "./routes.js";

export interface JobsAdminOptions {
  readonly policies: AppPolicies;
  readonly logger: Logger;
  readonly webOrigin: string;
  readonly producer: JobProducer;
  readonly board: JobsBoardSource;
  readonly boardEnabled?: boolean;
  readonly boardBasePath?: string;
  readonly environment: string;
  readonly csrfSecret: string;
  readonly allowedOrigins: readonly string[];
}

export function setupJobsAdminApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: JobsAdminOptions,
) {
  const policy = createJobsAdminPolicy({
    logger: options.logger,
    policies: options.policies,
  });
  const withJobsRoutes = setupExampleJobsApp(app, {
    producer: options.producer,
    beforeAuthorization: policy.beforeAuthorization,
    authorization: policy.authorization,
  });

  if (!options.boardEnabled) return withJobsRoutes;
  return setupJobsBoard(withJobsRoutes, {
    board: options.board,
    environment: options.environment,
    ...(options.boardBasePath ? { basePath: options.boardBasePath } : {}),
    authorization: policy.boardAuthorization,
    beforeMiddleware: policy.beforeAuthorization,
    csrfSecret: options.csrfSecret,
    allowedOrigins: options.allowedOrigins,
  });
}
