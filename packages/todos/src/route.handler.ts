import { createFactory } from "hono/factory";
import { describeRoute, validator } from "hono-openapi";
import {
  createTodoDescription,
  deleteTodoDescription,
  listTodosDescription,
  updateTodoDescription,
} from "./route.desc.js";
import { createTodoSchema, todoIdSchema, updateTodoSchema } from "./schemas.js";
import type { SetupTodosAppOptions, TodoRouteVariables } from "./types.js";

const todoFactory = createFactory<{ Variables: TodoRouteVariables }>();
const todoNotFound = { error: "Todo not found" } as const;

function tenantContext(options: SetupTodosAppOptions) {
  return todoFactory.createMiddleware(async (context, next) => {
    const tenantId = options.getTenantId(context);
    if (!tenantId) throw new Error("Tenant context is required");
    context.set("todoTenantId", tenantId);
    await next();
  });
}

export function listTodoHandlers(options: SetupTodosAppOptions) {
  return todoFactory.createHandlers(
    describeRoute(listTodosDescription),
    options.authorization.read,
    tenantContext(options),
    async (context) => {
      const todos = await options.service.listTodos(context.var.todoTenantId);
      return context.json({ todos }, 200);
    },
  );
}

export function createTodoHandlers(options: SetupTodosAppOptions) {
  return todoFactory.createHandlers(
    describeRoute(createTodoDescription),
    options.authorization.write,
    validator("json", createTodoSchema),
    tenantContext(options),
    async (context) => {
      const todo = await options.service.createTodo(
        context.var.todoTenantId,
        context.req.valid("json"),
      );
      return context.json(todo, 201);
    },
  );
}

export function updateTodoHandlers(options: SetupTodosAppOptions) {
  return todoFactory.createHandlers(
    describeRoute(updateTodoDescription),
    options.authorization.write,
    validator("param", todoIdSchema),
    validator("json", updateTodoSchema),
    tenantContext(options),
    async (context) => {
      const { id } = context.req.valid("param");
      const todo = await options.service.updateTodo(context.var.todoTenantId, {
        id,
        ...context.req.valid("json"),
      });
      if (!todo) return context.json(todoNotFound, 404);
      return context.json(todo, 200);
    },
  );
}

export function deleteTodoHandlers(options: SetupTodosAppOptions) {
  return todoFactory.createHandlers(
    describeRoute(deleteTodoDescription),
    options.authorization.delete,
    tenantContext(options),
    validator("param", todoIdSchema),
    async (context) => {
      const { id } = context.req.valid("param");
      const deleted = await options.service.deleteTodo(context.var.todoTenantId, { id });
      if (!deleted) return context.json(todoNotFound, 404);
      return context.body(null, 204);
    },
  );
}
