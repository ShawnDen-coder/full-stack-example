import type { Env, Hono, Schema } from "hono";
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
    .get("/", ...listTodoHandlers(options))
    .post("/", ...createTodoHandlers(options))
    .patch("/:id", ...updateTodoHandlers(options))
    .delete("/:id", ...deleteTodoHandlers(options));
}

export function setupTodosApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: SetupTodosAppOptions,
) {
  return app.route("/api/todos", createTodoRoutes(options));
}
