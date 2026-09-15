import type { TodosApiType } from "@full-stack-example/todos";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hc } from "hono/client";
import { createApiClientOptions, getApiBaseUrl } from "../../lib/api-client-options.js";
import { throwApiError } from "../../lib/api-error.js";
export function createTodosApiClient(baseUrl: string, fetchImplementation?: typeof fetch) {
  return hc<TodosApiType>(
    `${baseUrl.replace(/\/$/, "")}/api`,
    createApiClientOptions(fetchImplementation),
  );
}
export const todosApi = createTodosApiClient(getApiBaseUrl());

export const todosQueryOptions = (organizationId: string) => ({
  // 组织 ID 必须进入 query key，避免租户切换时串用 Todo 缓存。
  queryKey: ["todos", organizationId] as const,
  queryFn: listTodos,
  staleTime: 30_000,
});

async function listTodos() {
  const response = await todosApi.todos.$get();
  if (response.ok) return response.json();
  return throwApiError(response);
}

async function createTodo(title: string) {
  const response = await todosApi.todos.$post({ json: { title } });
  if (response.status === 201) return response.json();
  return throwApiError(response);
}

async function updateTodo(input: { readonly id: number; readonly completed: boolean }) {
  const response = await todosApi.todos[":id"].$patch({
    param: { id: input.id.toString() },
    json: { completed: input.completed },
  });
  if (response.ok) return response.json();
  return throwApiError(response);
}

async function deleteTodo(id: number) {
  const response = await todosApi.todos[":id"].$delete({ param: { id: id.toString() } });
  if (response.status === 204) return;
  return throwApiError(response);
}

export function useTodos(organizationId: string) {
  return useQuery(todosQueryOptions(organizationId));
}

export function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
}
