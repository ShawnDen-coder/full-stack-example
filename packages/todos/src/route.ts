import type { Env, Hono, Schema } from "hono";
import { Hono as HonoApp } from "hono";
import { createFactory } from "hono/factory";
import {
  createTodoHandlers,
  deleteTodoHandlers,
  listTodoHandlers,
  updateTodoHandlers,
} from "./route.handler.js";
import type { SetupTodosAppOptions, TodoRouteVariables } from "./types.js";

const todoFactory = createFactory<{ Variables: TodoRouteVariables }>();

function createTodoRoutes(options: SetupTodosAppOptions) {
  return todoFactory
    .createApp()
    .get("/todos", ...listTodoHandlers(options))
    .post("/todos", ...createTodoHandlers(options))
    .patch("/todos/:id", ...updateTodoHandlers(options))
    .delete("/todos/:id", ...deleteTodoHandlers(options));
}

function createMountedTodoRoutes(options: SetupTodosAppOptions) {
  return new HonoApp().route("/api", createTodoRoutes(options));
}

export type TodosApiType = ReturnType<typeof createMountedTodoRoutes>;

export function setupTodosApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: SetupTodosAppOptions,
) {
  return app.route("/", createMountedTodoRoutes(options));
}
