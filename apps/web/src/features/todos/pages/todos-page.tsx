import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../../auth/client.js";
import { Alert } from "../../../components/ui/alert.js";
import { buttonVariants } from "../../../components/ui/button.js";
import { Card, CardContent } from "../../../components/ui/card.js";
import { AccountMenu } from "../../../components/ui/account-menu.js";
import { ThemeSelect } from "../../../app/theme-provider.js";
import { useCreateTodo, useDeleteTodo, useTodos, useUpdateTodo } from "../api.js";
import { TodoComposer } from "../components/todo-composer.js";
import { TodoList } from "../components/todo-list.js";

export function TodosPage({ organizationId }: { readonly organizationId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const workspace = authClient.useActiveOrganization();
  const memberRole = authClient.useActiveMemberRole();
  const todos = useTodos(organizationId);
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const isMutating = createTodo.isPending || updateTodo.isPending || deleteTodo.isPending;
  const canDelete = memberRole.data?.role === "owner" || memberRole.data?.role === "admin";
  const [signOutError, setSignOutError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSignOutError(false);
    setSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) return setSignOutError(true);
      await queryClient.removeQueries({ queryKey: ["todos"] });
      await navigate({ to: "/login", search: { returnTo: "/todos" } });
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  }

  function handleSubmit(title: string, reset: () => void) {
    createTodo.mutate(title, { onSuccess: reset });
  }

  return (
    <main className="relative min-h-screen bg-background p-4 text-foreground sm:p-10">
      <ThemeSelect className="absolute right-4 top-4 sm:right-8 sm:top-6" />
      <Card className="mx-auto mt-14 max-w-xl">
        <CardContent className="grid gap-5 p-4 sm:p-6">
          <div className="flex flex-col items-start gap-3 rounded-lg bg-muted p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div>
                <h1 className="text-3xl font-semibold">Todos</h1>
                <p className="text-sm text-muted-foreground">
                  {workspace.data?.name ?? "当前工作区"}
                  {session.data?.user?.email ? ` · ${session.data.user.email}` : ""}
                </p>
              </div>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <Link
                className={buttonVariants({ size: "sm", variant: "ghost" })}
                to="/workspaces"
                search={{ returnTo: "/todos" }}
              >
                切换工作区
              </Link>
              <AccountMenu
                disabled={signingOut}
                email={session.data?.user?.email ?? undefined}
                onSignOut={() => void signOut()}
              />
            </div>
          </div>
          <TodoComposer disabled={isMutating} onSubmit={handleSubmit} />
          {signOutError ? <Alert className="border-destructive/40 text-destructive" role="alert">退出失败，请重试。</Alert> : null}
          {createTodo.isError || updateTodo.isError || deleteTodo.isError ? (
            <Alert className="border-destructive/40 text-destructive" role="alert">
              操作失败，请稍后重试。
            </Alert>
          ) : null}
          {todos.isLoading ? (
            <span
              className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"
              role="status"
              aria-label="正在加载待办事项"
            />
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
