import { type AuthModule, setupAuthApp } from "@full-stack-example/auth/server";
import { setupJobsApp } from "@full-stack-example/jobs";
import type { JobService, JobsBoardSource } from "@full-stack-example/jobs/contracts";
import { setupJobsBoard } from "@full-stack-example/jobs/server";
import type { Logger, LogStream } from "@full-stack-example/logging";
import { setupSystemApp } from "@full-stack-example/system";
import { setupTodosApp, type TenantTodoService } from "@full-stack-example/todos";
import type { ApplyGlobalResponse } from "hono/client";
import { setupApiDocs } from "./api-docs.js";
import { createHttpApp } from "./http.js";
import { createJobsAdminPolicy } from "./jobs-admin.js";
import { setupLogStreamApp } from "./log-stream.js";
import { setupWebApp } from "./web-app.js";

interface CreateAppBaseOptions {
  readonly logger: Logger;
  readonly http: { readonly webOrigin: string; readonly apiOrigin?: string };
  readonly environment?: string;
  readonly csrfSecret?: string;
  readonly documentation: { readonly enabled: boolean };
  readonly web: { readonly assetsDirectory?: string };
}

interface JobsAppModule {
  readonly service: JobService;
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
  if (!options.modules.auth) throw new Error("The API requires an authentication module");
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
      read: options.modules.auth.require.requireTenantPermission({
        resource: "todos",
        action: "read",
      }),
      write: options.modules.auth.require.requireTenantPermission({
        resource: "todos",
        action: "write",
      }),
      delete: options.modules.auth.require.requireTenantPermission({
        resource: "todos",
        action: "delete",
      }),
    },
    getTenantId: (context) => context.get("tenantPrincipal")?.tenantId,
  });
  const jobsPolicy = createJobsAdminPolicy({
    auth: options.modules.auth,
    logger: options.logger,
    webOrigin: options.http.webOrigin,
  });
  const withJobs = options.modules.jobs
    ? setupJobsApp(withTodos, {
        service: options.modules.jobs.service,
        beforeAuthorization: jobsPolicy.beforeAuthorization,
        authorization: jobsPolicy.authorization,
      })
    : withTodos;
  const withBoard =
    options.modules.jobs?.boardEnabled && options.modules.auth
      ? setupJobsBoard(withJobs, {
          board: options.modules.jobs.board,
          environment: options.environment ?? "development",
          ...(options.modules.jobs.boardBasePath
            ? { basePath: options.modules.jobs.boardBasePath }
            : {}),
          authorization: jobsPolicy.boardAuthorization,
          beforeMiddleware: jobsPolicy.beforeAuthorization,
          csrfSecret: options.csrfSecret ?? "development-bull-board-csrf-secret-change-me",
          allowedOrigins: [
            options.http.webOrigin,
            options.http.apiOrigin ?? options.http.webOrigin,
          ],
        })
      : withJobs;
  const withLogStream = options.modules.logStream
    ? setupLogStreamApp(withBoard, {
        stream: options.modules.logStream.stream,
        heartbeatMs: options.modules.logStream.heartbeatMs ?? 15_000,
        authorization: [
          options.modules.auth.require.requireSession,
          options.modules.auth.require.requirePlatformAdmin,
          options.modules.auth.require.requireFreshSession,
        ],
      })
    : withBoard;
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
