import { zValidator } from "@hono/zod-validator";
import type { Env, Hono, Schema } from "hono";
import { createTodoSchema, todoIdSchema, updateTodoSchema } from "./schemas.js";
import type { TodoService } from "./service.js";

const todoNotFound = { error: "Todo not found" };

export function setupTodosApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: { readonly service: TodoService },
) {
  return app
    .get("/api/todos", async (context) => {
      const todos = await options.service.listTodos();
      return context.json({ todos }, 200);
    })
    .post("/api/todos", zValidator("json", createTodoSchema), async (context) => {
      const todo = await options.service.createTodo(context.req.valid("json"));
      return context.json(todo, 201);
    })
    .patch(
      "/api/todos/:id",
      zValidator("param", todoIdSchema),
      zValidator("json", updateTodoSchema),
      async (context) => {
        const { id } = context.req.valid("param");
        const todo = await options.service.updateTodo({ id, ...context.req.valid("json") });
        if (!todo) return context.json(todoNotFound, 404);
        return context.json(todo, 200);
      },
    )
    .delete("/api/todos/:id", zValidator("param", todoIdSchema), async (context) => {
      const { id } = context.req.valid("param");
      const deleted = await options.service.deleteTodo({ id });
      if (!deleted) return context.json(todoNotFound, 404);
      return context.body(null, 204);
    });
}
