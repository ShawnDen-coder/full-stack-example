import { Alert, Card, CardContent, CardHeader, Skeleton, Typography } from "@mui/material";
import { authClient } from "../../features/auth/client.js";
import { useCreateTodo, useDeleteTodo, useTodos, useUpdateTodo } from "../../features/todos/api.js";
import { TodoComposer } from "./todo-composer.js";
import { TodoList } from "./todo-list.js";

export function TodosPage({ organizationId }: { readonly organizationId: string }) {
  const memberRole = authClient.useActiveMemberRole();
  const todos = useTodos(organizationId);
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const isMutating = createTodo.isPending || updateTodo.isPending || deleteTodo.isPending;
  const canDelete = memberRole.data?.role === "owner" || memberRole.data?.role === "admin";

  function handleSubmit(title: string, reset: () => void) {
    createTodo.mutate(title, { onSuccess: reset });
  }

  return (
    <main id="main-content" className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6">
      <Card className="mx-auto max-w-3xl">
        <CardHeader title={<Typography variant="h5">Todos</Typography>} />
        <CardContent className="grid gap-5">
          <TodoComposer disabled={isMutating} onSubmit={handleSubmit} />
          {createTodo.isError || updateTodo.isError || deleteTodo.isError ? (
            <Alert role="alert">操作失败，请稍后重试。</Alert>
          ) : null}
          {todos.isLoading ? (
            <div aria-label="正在加载待办事项" className="grid gap-3" role="status">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : null}
          {todos.isError ? <Alert role="alert">无法加载待办事项。</Alert> : null}
          {todos.data ? (
            <TodoList
              canDelete={canDelete}
              disabled={isMutating}
              onDelete={(id) => deleteTodo.mutate(id)}
              onToggle={(todo, completed) => updateTodo.mutate({ id: todo.id, completed })}
              todos={todos.data.todos}
            />
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
