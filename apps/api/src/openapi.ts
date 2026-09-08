import {
  createTodoSchema,
  todoListSchema,
  todoSchema,
  updateTodoSchema,
} from "../../../packages/todos/src/schemas.js";
import { healthResponseSchema } from "../../../packages/system/src/schemas.js";
import { z } from "zod";

type JsonSchema = Record<string, unknown>;

function jsonSchema(schema: z.ZodType): JsonSchema {
  return z.toJSONSchema(schema, { target: "draft-2020-12" }) as JsonSchema;
}

const todoIdParameter = { name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } };

export function createOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Full Stack Example API",
      version: "0.1.0",
      description: "HTTP API for health checks and todo management.",
    },
    paths: {
      "/health": {
        get: {
          operationId: "getHealth",
          tags: ["system"],
          summary: "Get service health",
          responses: {
            "200": { description: "The service is healthy.", content: { "application/json": { schema: jsonSchema(healthResponseSchema) } } },
            "503": { description: "The database health check is degraded.", content: { "application/json": { schema: jsonSchema(healthResponseSchema) } } },
          },
        },
      },
      "/api/todos": {
        get: {
          operationId: "listTodos",
          tags: ["todos"],
          summary: "List todos",
          responses: { "200": { description: "Todo list.", content: { "application/json": { schema: jsonSchema(todoListSchema) } } } },
        },
        post: {
          operationId: "createTodo",
          tags: ["todos"],
          summary: "Create a todo",
          requestBody: { required: true, content: { "application/json": { schema: jsonSchema(createTodoSchema) } } },
          responses: { "201": { description: "Created todo.", content: { "application/json": { schema: jsonSchema(todoSchema) } } } },
        },
      },
      "/api/todos/{id}": {
        patch: {
          operationId: "updateTodo",
          tags: ["todos"],
          summary: "Update todo completion",
          parameters: [todoIdParameter],
          requestBody: { required: true, content: { "application/json": { schema: jsonSchema(updateTodoSchema) } } },
          responses: {
            "200": { description: "Updated todo.", content: { "application/json": { schema: jsonSchema(todoSchema) } } },
            "404": { description: "Todo not found.", content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" } }, required: ["error"] } } } },
          },
        },
        delete: {
          operationId: "deleteTodo",
          tags: ["todos"],
          summary: "Delete a todo",
          parameters: [todoIdParameter],
          responses: { "204": { description: "Todo deleted." }, "404": { description: "Todo not found." } },
        },
      },
    },
  };
}
