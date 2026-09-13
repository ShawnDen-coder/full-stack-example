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

function decodePathSegment(segment: string | undefined): string | undefined {
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export type CreateAppOptions = CreateAppBaseOptions & {
  readonly modules: BaseModules &
    (
      | {
          readonly auth: AuthModule;
          readonly jobs?: JobsAppModule;
          readonly logStream?: { readonly stream: LogStream; readonly heartbeatMs?: number };
        }
      | {
          readonly auth?: never;
          readonly jobs?: never;
          readonly logStream?: never;
        }
    );
};

export function createApp(options: CreateAppOptions) {
  if ((options.modules.jobs || options.modules.logStream) && !options.modules.auth)
    throw new Error("Jobs and log stream modules require authentication");
  const withErrors = createHttpApp({ logger: options.logger, webOrigin: options.http.webOrigin })
    .notFound((context) => context.json({ error: "Not found" }, 404))
    .onError((_error, context) => context.json({ error: "Internal server error" }, 500));
  const withSystem = setupSystemApp(withErrors, {
    checkDatabase: options.modules.system.checkDatabase,
    onProbeFailure: () =>
      options.logger
        .getChild("system")
        .warn("Database health check failed", { event: "system.health.degraded" }),
  });

  const withAuth = options.modules.auth
    ? setupAuthApp(withSystem, { auth: options.modules.auth })
    : withSystem;
  const allowWithoutAuth = async (_context: import("hono").Context, next: import("hono").Next) =>
    next();
  const requireSameOrigin = async (context: import("hono").Context, next: import("hono").Next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(context.req.method)) return next();
    const origin = context.req.header("Origin");
    const requestOrigin = new URL(context.req.url).origin;
    if (!origin || (origin !== options.http.webOrigin && origin !== requestOrigin))
      return context.json({ error: "CSRF validation failed" }, 403);
    return next();
  };
  const auditJobMutation: import("hono").MiddlewareHandler = async (context, next) => {
    const startedAt = Date.now();
    if (["GET", "HEAD", "OPTIONS"].includes(context.req.method)) return next();
    let thrown = false;
    try {
      await next();
    } catch (error) {
      thrown = true;
      throw error;
    } finally {
      const path = new URL(context.req.url).pathname;
      const segments = path.split("/").filter(Boolean);
      const queueIndex = segments.lastIndexOf("queues");
      const jobIndex = segments.indexOf("jobs");
      const boardJobsIndex = segments.lastIndexOf("jobs");
      const queueSegment = queueIndex >= 0 ? segments[queueIndex + 1] : undefined;
      const jobSegment =
        queueIndex >= 0 && boardJobsIndex > queueIndex ? segments[boardJobsIndex + 1] : undefined;
      const jobResource = jobIndex >= 0 ? segments[jobIndex + 1] : undefined;
      const queueName = decodePathSegment(queueSegment);
      const jobId = decodePathSegment(jobSegment);
      const jobResourceName = decodePathSegment(jobResource);
      options.logger.info("Job administration mutation", {
        event: "jobs.mutation",
        actorUserId: (context.get("sessionPrincipal") as { readonly userId?: string } | undefined)
          ?.userId,
        requestId: context.req.header("x-request-id"),
        method: context.req.method,
        path,
        ...(queueName ? { queueName } : {}),
        ...(jobId ? { jobId } : {}),
        ...(jobResourceName ? { jobResource: jobResourceName } : {}),
        status: thrown ? 500 : context.res.status,
        durationMs: Date.now() - startedAt,
      });
    }
  };
  const requireFreshForMutation = async (
    context: import("hono").Context,
    next: import("hono").Next,
  ) => {
    if (["GET", "HEAD", "OPTIONS"].includes(context.req.method)) return next();
    if (!options.modules.auth) return next();
    return options.modules.auth.require.requireFreshSession(context, next);
  };
  const withTodos = setupTodosApp(withAuth, {
    service: options.modules.todos.service,
    authorization: {
      read: options.modules.auth
        ? options.modules.auth.require.requireTenantPermission({
            resource: "todos",
            action: "read",
          })
        : allowWithoutAuth,
      write: options.modules.auth
        ? options.modules.auth.require.requireTenantPermission({
            resource: "todos",
            action: "write",
          })
        : allowWithoutAuth,
      delete: options.modules.auth
        ? options.modules.auth.require.requireTenantPermission({
            resource: "todos",
            action: "delete",
          })
        : allowWithoutAuth,
    },
    getTenantId: (context) => context.get("tenantPrincipal")?.tenantId,
  });
  const withJobs = options.modules.jobs
    ? setupJobsApp(withTodos, {
        service: options.modules.jobs.service,
        beforeAuthorization: [auditJobMutation],
        authorization: [
          requireSameOrigin,
          options.modules.auth.require.requireSession,
          options.modules.auth.require.requirePlatformAdmin,
          options.modules.auth.require.requireFreshSession,
        ],
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
          authorization: [
            requireSameOrigin,
            options.modules.auth.require.requireSession,
            options.modules.auth.require.requirePlatformAdmin,
            requireFreshForMutation,
          ],
          beforeMiddleware: [auditJobMutation],
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
    ...(options.modules.auth ? { auth: options.modules.auth } : {}),
  });
  return setupWebApp(withApiDocs, options.web);
}

export type AppType = ApplyGlobalResponse<
  ReturnType<typeof createApp>,
  { 500: { json: { error: string } } }
>;
