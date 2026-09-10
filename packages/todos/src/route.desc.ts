import { type DescribeRouteOptions, resolver } from "hono-openapi";
import { z } from "zod";
import { todoListSchema, todoNotFoundSchema, todoSchema } from "./schemas.js";

const internalErrorSchema = z.object({ error: z.literal("Internal server error") });
const unauthorizedSchema = z.object({ error: z.literal("Unauthorized") });
const activeOrganizationRequiredSchema = z.object({
  error: z.literal("Active organization required"),
});
const forbiddenSchema = z.object({ error: z.literal("Forbidden") });

type RouteResponses = NonNullable<DescribeRouteOptions["responses"]>;

export const authorizationResponses: RouteResponses = {
  400: {
    description: "An active workspace is required.",
    content: { "application/json": { schema: resolver(activeOrganizationRequiredSchema) } },
  },
  401: {
    description: "A valid Better Auth session is required.",
    content: { "application/json": { schema: resolver(unauthorizedSchema) } },
  },
  403: {
    description: "The current workspace role does not have permission for this action.",
    content: { "application/json": { schema: resolver(forbiddenSchema) } },
  },
} as const;

const internalErrorResponse = {
  500: {
    description: "Unexpected internal server error.",
    content: { "application/json": { schema: resolver(internalErrorSchema) } },
  },
} as const;

export const listTodosDescription: DescribeRouteOptions = {
  operationId: "listTodos",
  tags: ["todos"],
  summary: "List todos",
  description: "Return all todos for the active workspace, ordered by newest creation time.",
  responses: {
    200: {
      description: "Todo list.",
      content: { "application/json": { schema: resolver(todoListSchema) } },
    },
    ...authorizationResponses,
    ...internalErrorResponse,
  },
};

export const createTodoDescription: DescribeRouteOptions = {
  operationId: "createTodo",
  tags: ["todos"],
  summary: "Create a todo",
  description: "Create a todo in the active workspace after trimming and validating its title.",
  responses: {
    201: {
      description: "Created todo.",
      content: { "application/json": { schema: resolver(todoSchema) } },
    },
    ...authorizationResponses,
    ...internalErrorResponse,
  },
};

export const updateTodoDescription: DescribeRouteOptions = {
  operationId: "updateTodo",
  tags: ["todos"],
  summary: "Update todo completion",
  description: "Update the completion state of one todo in the active workspace.",
  responses: {
    200: {
      description: "Updated todo.",
      content: { "application/json": { schema: resolver(todoSchema) } },
    },
    404: {
      description: "Todo not found.",
      content: { "application/json": { schema: resolver(todoNotFoundSchema) } },
    },
    ...authorizationResponses,
    ...internalErrorResponse,
  },
};

export const deleteTodoDescription: DescribeRouteOptions = {
  operationId: "deleteTodo",
  tags: ["todos"],
  summary: "Delete a todo",
  description:
    "Permanently delete one todo from the active workspace. Members cannot delete todos.",
  responses: {
    204: { description: "Todo deleted." },
    404: {
      description: "Todo not found.",
      content: { "application/json": { schema: resolver(todoNotFoundSchema) } },
    },
    ...authorizationResponses,
    ...internalErrorResponse,
  },
};
