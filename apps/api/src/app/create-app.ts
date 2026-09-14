import { type AuthModule, setupAuthApp } from "@full-stack-example/auth/server";
import type { JobProducer, JobsBoardSource } from "@full-stack-example/jobs/contracts";
import type { Logger, LogStream } from "@full-stack-example/logging";
import { setupSystemApp } from "@full-stack-example/system";
import { setupTodosApp, type TenantTodoService } from "@full-stack-example/todos";
import type { ApplyGlobalResponse } from "hono/client";
import { appFactory } from "./env.js";
import { setupLogStreamApp } from "../features/diagnostics/log-stream.js";
import { setupJobsBoardApp } from "../features/jobs-admin/board.js";
import { setupJobsAdminApp } from "../features/jobs-admin/setup.js";
import { createHttpApp } from "./http.js";
import { setupApiDocs } from "./openapi.js";
import { createAppPolicies } from "./policies.js";
import { setupWebApp } from "./web-assets.js";

interface CreateAppBaseOptions {
  readonly logger: Logger;
  readonly http: { readonly webOrigin: string; readonly apiOrigin?: string };
}

interface JobsAdminFeature {
  readonly producer: JobProducer;
}

interface JobsBoardFeature {
  readonly source: JobsBoardSource;
  readonly basePath: string;
  readonly environment: string;
  readonly csrfSecret: string;
  readonly allowedOrigins: readonly string[];
}

type AppServices = {
  readonly auth: AuthModule;
  readonly system: { readonly checkDatabase: () => Promise<void> };
  readonly todos: TenantTodoService;
};

export type CreateAppOptions = CreateAppBaseOptions & {
  readonly services: AppServices;
  readonly features: {
    readonly jobsAdmin?: JobsAdminFeature;
    readonly jobsBoard?: JobsBoardFeature;
    readonly logStream?: { readonly stream: LogStream; readonly heartbeatMs?: number };
    readonly documentation: { readonly enabled: boolean };
    readonly web: { readonly assetsDirectory?: string };
  };
};

export function createApp(options: CreateAppOptions) {
  const policies = createAppPolicies({
    auth: options.services.auth,
    webOrigin: options.http.webOrigin,
  });
  const withErrors = createHttpApp({ logger: options.logger, webOrigin: options.http.webOrigin })
    .notFound((context) =>
      context.json({ error: "Not found", requestId: context.get("requestId") }, 404),
    )
    .onError((error, context) => {
      options.logger.error("Unhandled API request error", {
        event: "http.request.failed",
        requestId: context.get("requestId"),
        method: context.req.method,
        path: context.req.path,
        error,
      });
      return context.json(
        { error: "Internal server error", requestId: context.get("requestId") },
        500,
      );
    });
  const apiApp = appFactory.createApp();
  const apiWithAuth = setupAuthApp(apiApp, { auth: options.services.auth });
  const apiWithTodos = setupTodosApp(apiWithAuth, {
    service: options.services.todos,
    authorization: {
      read: policies.tenantPermission({ resource: "todos", action: "read" }),
      write: policies.tenantPermission({ resource: "todos", action: "write" }),
      delete: policies.tenantPermission({ resource: "todos", action: "delete" }),
    },
    getTenantId: policies.resolveTenantId,
  });
  const apiWithJobs = options.features.jobsAdmin
    ? setupJobsAdminApp(apiWithTodos, {
        policies,
        logger: options.logger,
        producer: options.features.jobsAdmin.producer,
      })
    : apiWithTodos;
  const apiRoutes = options.features.logStream
    ? setupLogStreamApp(apiWithJobs, {
        stream: options.features.logStream.stream,
        heartbeatMs: options.features.logStream.heartbeatMs ?? 15_000,
        authorization: policies.platformAdminFresh,
      })
    : apiWithJobs;

  const withSystem = setupSystemApp(withErrors, {
    checkDatabase: options.services.system.checkDatabase,
    onProbeFailure: () =>
      options.logger
        .getChild("system")
        .warn("Database health check failed", { event: "system.health.degraded" }),
  });

  const withJobsBoard =
    options.features.jobsBoard
      ? setupJobsBoardApp(withSystem, {
          logger: options.logger,
          policies,
          board: options.features.jobsBoard.source,
          basePath: options.features.jobsBoard.basePath,
          environment: options.features.jobsBoard.environment,
          csrfSecret: options.features.jobsBoard.csrfSecret,
          allowedOrigins: options.features.jobsBoard.allowedOrigins,
        })
      : withSystem;
  const withApi = withJobsBoard.route("/api", apiRoutes);
  const withApiDocs = setupApiDocs(withApi, {
    ...options.features.documentation,
    auth: options.services.auth,
  });
  return setupWebApp(withApiDocs, options.features.web);
}

export type AppType = ApplyGlobalResponse<
  ReturnType<typeof createApp>,
  { 500: { json: { error: string } } }
>;
