import { Alert } from "../../../components/ui/alert.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { Skeleton } from "../../../components/ui/skeleton.js";
import { authClient } from "../../auth/client.js";
import { useCreateTodo, useDeleteTodo, useTodos, useUpdateTodo } from "../api.js";
import { TodoComposer } from "../components/todo-composer.js";
import { TodoList } from "../components/todo-list.js";

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
    <main
      id="main-content"
      className="min-h-[calc(100vh-4rem)] bg-muted/40 px-4 py-8 text-foreground sm:px-6"
    >
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>Todos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <TodoComposer disabled={isMutating} onSubmit={handleSubmit} />
          {createTodo.isError || updateTodo.isError || deleteTodo.isError ? (
            <Alert className="border-destructive/40 text-destructive" role="alert">
              操作失败，请稍后重试。
            </Alert>
          ) : null}
          {todos.isLoading ? (
            <div aria-label="正在加载待办事项" className="grid gap-3" role="status">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : null}
          {todos.isError ? (
            <Alert className="border-destructive/40 text-destructive" role="alert">
              无法加载待办事项。
            </Alert>
          ) : null}
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
