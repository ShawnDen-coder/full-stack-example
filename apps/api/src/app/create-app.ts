import { type AuthModule, setupAuthApp } from "@full-stack-example/auth/server";
import type { JobProducer, JobsBoardSource } from "@full-stack-example/jobs/contracts";
import type { Logger, LogStream } from "@full-stack-example/logging";
import { setupSystemApp } from "@full-stack-example/system";
import { setupTodosApp, type TenantTodoService } from "@full-stack-example/todos";
import type { ApplyGlobalResponse } from "hono/client";
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
  readonly environment?: string;
  readonly csrfSecret?: string;
  readonly documentation: { readonly enabled: boolean };
  readonly web: { readonly assetsDirectory?: string };
}

interface JobsAppModule {
  readonly producer: JobProducer;
  readonly board: JobsBoardSource;
  readonly boardEnabled?: boolean;
  readonly boardBasePath?: string;
}

type BaseModules = {
  readonly system: { readonly checkDatabase: () => Promise<void> };
  readonly todos: { readonly service: TenantTodoService };
};

export type CreateAppOptions = CreateAppBaseOptions & {
  readonly modules: BaseModules & {
    readonly auth: AuthModule;
    readonly jobs?: JobsAppModule;
    readonly logStream?: { readonly stream: LogStream; readonly heartbeatMs?: number };
  };
};

export function createApp(options: CreateAppOptions) {
  const policies = createAppPolicies({
    auth: options.modules.auth,
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
  const withSystem = setupSystemApp(withErrors, {
    checkDatabase: options.modules.system.checkDatabase,
    onProbeFailure: () =>
      options.logger
        .getChild("system")
        .warn("Database health check failed", { event: "system.health.degraded" }),
  });

  const withAuth = setupAuthApp(withSystem, { auth: options.modules.auth });
  const withTodos = setupTodosApp(withAuth, {
    service: options.modules.todos.service,
    authorization: {
      read: policies.tenantPermission({ resource: "todos", action: "read" }),
      write: policies.tenantPermission({ resource: "todos", action: "write" }),
      delete: policies.tenantPermission({ resource: "todos", action: "delete" }),
    },
    getTenantId: policies.resolveTenantId,
  });
  const withJobs = options.modules.jobs
    ? setupJobsAdminApp(withTodos, {
        policies,
        logger: options.logger,
        producer: options.modules.jobs.producer,
      })
    : withTodos;
  const withJobsBoard =
    options.modules.jobs?.boardEnabled === true
      ? setupJobsBoardApp(withJobs, {
          logger: options.logger,
          policies,
          board: options.modules.jobs.board,
          ...(options.modules.jobs.boardBasePath
            ? { basePath: options.modules.jobs.boardBasePath }
            : {}),
          environment: options.environment ?? "development",
          csrfSecret: options.csrfSecret ?? "development-bull-board-csrf-secret-change-me",
          allowedOrigins: [options.http.webOrigin, options.http.apiOrigin ?? options.http.webOrigin],
        })
      : withJobs;
  const withLogStream = options.modules.logStream
    ? setupLogStreamApp(withJobsBoard, {
        stream: options.modules.logStream.stream,
        heartbeatMs: options.modules.logStream.heartbeatMs ?? 15_000,
        authorization: policies.platformAdminFresh,
      })
    : withJobsBoard;
  const withApiDocs = setupApiDocs(withLogStream, {
    ...options.documentation,
    auth: options.modules.auth,
  });
  return setupWebApp(withApiDocs, options.web);
}

export type AppType = ApplyGlobalResponse<
  ReturnType<typeof createApp>,
  { 500: { json: { error: string } } }
>;
