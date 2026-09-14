import type { JobProducer, JobsBoardSource } from "@full-stack-example/jobs/contracts";
import type { Logger } from "@full-stack-example/logging";
import type { Env, Hono, Schema } from "hono";
import type { AppPolicies } from "../../app/policies.js";
import { createJobsAdminPolicy } from "./policy.js";
import { setupExampleJobsApp } from "./routes.js";

export interface JobsAdminOptions {
  readonly policies: AppPolicies;
  readonly logger: Logger;
  readonly producer: JobProducer;
}

export function setupJobsAdminApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: JobsAdminOptions,
) {
  const policy = createJobsAdminPolicy({
    logger: options.logger,
    policies: options.policies,
  });
  return setupExampleJobsApp(app, {
    producer: options.producer,
    beforeAuthorization: policy.beforeAuthorization,
    authorization: policy.authorization,
  });
}

export interface JobsBoardOptions {
  readonly policies: AppPolicies;
  readonly logger: Logger;
  readonly board: JobsBoardSource;
  readonly environment: string;
  readonly csrfSecret: string;
  readonly allowedOrigins: readonly string[];
  readonly basePath?: string;
}
