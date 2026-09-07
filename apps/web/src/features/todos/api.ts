import { parseResponse } from "@full-stack-example/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.js";

const todosQueryKey = ["todos"] as const;

async function listTodos() {
  const response = await api.api.todos.$get();
  if (response.ok) return response.json();
  return parseResponse(response);
}

async function createTodo(title: string) {
  const response = await api.api.todos.$post({ json: { title } });
  if (response.status === 201) return response.json();
  return parseResponse(response);
}

async function updateTodo(input: { readonly id: number; readonly completed: boolean }) {
  const response = await api.api.todos[":id"].$patch({
    param: { id: input.id.toString() },
    json: { completed: input.completed },
  });
  if (response.ok) return response.json();
  return parseResponse(response);
}

async function deleteTodo(id: number) {
  const response = await api.api.todos[":id"].$delete({ param: { id: id.toString() } });
  if (response.status === 204) return;
  return parseResponse(response);
}

export function useTodos() {
  return useQuery({ queryKey: todosQueryKey, queryFn: listTodos });
}

export function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todosQueryKey }),
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todosQueryKey }),
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todosQueryKey }),
  });
}
