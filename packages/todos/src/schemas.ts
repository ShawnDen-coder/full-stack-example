import { z } from "zod";

export const todoSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  completed: z.boolean(),
});

export const todoListSchema = z.object({ todos: z.array(todoSchema) });

export const createTodoSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export const updateTodoSchema = z.object({ completed: z.boolean() });

export const todoIdSchema = z.object({ id: z.coerce.number().int().positive() });

export const todoNotFoundSchema = z.object({ error: z.literal("Todo not found") });

export type Todo = z.infer<typeof todoSchema>;
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
