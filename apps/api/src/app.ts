import { type AuthModule, setupAuthApp } from "@full-stack-example/auth/server";
import type { Logger, LogStream } from "@full-stack-example/logging";
import { setupSystemApp } from "@full-stack-example/system";
import { setupTodosApp, type TenantTodoService } from "@full-stack-example/todos";
import type { ApplyGlobalResponse } from "hono/client";
import { setupApiDocs } from "./api-docs.js";
import { createHttpApp } from "./http.js";
import { setupLogStreamApp } from "./log-stream.js";
import { setupWebApp } from "./web-app.js";

export interface CreateAppOptions {
  readonly logger: Logger;
  readonly http: { readonly webOrigin: string };
  readonly documentation: { readonly enabled: boolean };
  readonly modules: {
    readonly system: { readonly checkDatabase: () => Promise<void> };
    readonly todos: { readonly service: TenantTodoService };
    readonly auth?: AuthModule;
    readonly logStream?: { readonly stream: LogStream; readonly heartbeatMs?: number };
  };
  readonly web: { readonly assetsDirectory?: string };
}

export function createApp(options: CreateAppOptions) {
  const withErrors = createHttpApp({ logger: options.logger, ...options.http })
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
    getTenantId: (context) =>
      (context.get("tenantPrincipal") as { readonly tenantId?: string } | undefined)?.tenantId,
  });
  const withLogStream = setupLogStreamApp(withTodos, {
    stream: options.modules.logStream?.stream,
    heartbeatMs: options.modules.logStream?.heartbeatMs ?? 15_000,
  });
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
