import type { Env, Hono, Schema } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import {
  createTodoSchema,
  todoIdSchema,
  todoListSchema,
  todoNotFoundSchema,
  todoSchema,
  updateTodoSchema,
} from "./schemas.js";
import type { TodoService } from "./service.js";

const todoNotFound = { error: "Todo not found" } as const;
const internalErrorSchema = z.object({ error: z.literal("Internal server error") });

export function setupTodosApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: { readonly service: TodoService },
) {
  return app
    .get(
      "/api/todos",
      describeRoute({
        operationId: "listTodos",
        tags: ["todos"],
        summary: "List todos",
        description: "Return all todos ordered by newest creation time.",
        responses: {
          200: {
            description: "Todo list.",
            content: { "application/json": { schema: resolver(todoListSchema) } },
          },
          500: {
            description: "Unexpected internal server error.",
            content: { "application/json": { schema: resolver(internalErrorSchema) } },
          },
        },
      }),
      async (context) => {
        const todos = await options.service.listTodos();
        return context.json({ todos }, 200);
      },
    )
    .post(
      "/api/todos",
      describeRoute({
        operationId: "createTodo",
        tags: ["todos"],
        summary: "Create a todo",
        description: "Create a todo after trimming and validating its title.",
        responses: {
          201: {
            description: "Created todo.",
            content: { "application/json": { schema: resolver(todoSchema) } },
          },
          500: {
            description: "Unexpected internal server error.",
            content: { "application/json": { schema: resolver(internalErrorSchema) } },
          },
        },
      }),
      validator("json", createTodoSchema),
      async (context) => {
        const todo = await options.service.createTodo(context.req.valid("json"));
        return context.json(todo, 201);
      },
    )
    .patch(
      "/api/todos/:id",
      describeRoute({
        operationId: "updateTodo",
        tags: ["todos"],
        summary: "Update todo completion",
        description: "Update the completion state of one todo.",
        responses: {
          200: {
            description: "Updated todo.",
            content: { "application/json": { schema: resolver(todoSchema) } },
          },
          404: {
            description: "Todo not found.",
            content: { "application/json": { schema: resolver(todoNotFoundSchema) } },
          },
          500: {
            description: "Unexpected internal server error.",
            content: { "application/json": { schema: resolver(internalErrorSchema) } },
          },
        },
      }),
      validator("param", todoIdSchema),
      validator("json", updateTodoSchema),
      async (context) => {
        const { id } = context.req.valid("param");
        const todo = await options.service.updateTodo({ id, ...context.req.valid("json") });
        if (!todo) return context.json(todoNotFound, 404);
        return context.json(todo, 200);
      },
    )
    .delete(
      "/api/todos/:id",
      describeRoute({
        operationId: "deleteTodo",
        tags: ["todos"],
        summary: "Delete a todo",
        description: "Permanently delete one todo.",
        responses: {
          204: { description: "Todo deleted." },
          404: {
            description: "Todo not found.",
            content: { "application/json": { schema: resolver(todoNotFoundSchema) } },
          },
          500: {
            description: "Unexpected internal server error.",
            content: { "application/json": { schema: resolver(internalErrorSchema) } },
          },
        },
      }),
      validator("param", todoIdSchema),
      async (context) => {
        const { id } = context.req.valid("param");
        const deleted = await options.service.deleteTodo({ id });
        if (!deleted) return context.json(todoNotFound, 404);
        return context.body(null, 204);
      },
    );
}
