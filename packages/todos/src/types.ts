import type { Context, MiddlewareHandler } from "hono";
import type { TenantTodoService } from "./service.js";

export interface TodoRouteVariables {
  todoTenantId: string;
}

export interface TodoAuthorization {
  readonly read: MiddlewareHandler;
  readonly write: MiddlewareHandler;
  readonly delete: MiddlewareHandler;
}

export interface SetupTodosAppOptions {
  readonly service: TenantTodoService;
  readonly authorization: TodoAuthorization;
  /** Resolves the tenant identity after the host's authorization middleware has run. */
  readonly getTenantId: (context: Context) => string | undefined;
}
