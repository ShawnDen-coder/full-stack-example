import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { TodoComposer } from "../components/todos/todo-composer.js";
import { TodoList } from "../components/todos/todo-list.js";
import { authClient } from "../features/auth/client.js";
import { useCreateTodo, useDeleteTodo, useTodos, useUpdateTodo } from "../features/todos/api.js";

export function TodosPage() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const workspace = authClient.useActiveOrganization();
  const memberRole = authClient.useActiveMemberRole();
  const [title, setTitle] = useState("");
  const todos = useTodos();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const isMutating = createTodo.isPending || updateTodo.isPending || deleteTodo.isPending;
  const canDelete = memberRole.data?.role === "owner" || memberRole.data?.role === "admin";

  async function signOut() {
    await authClient.signOut();
    navigate("/login");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    createTodo.mutate(trimmedTitle, { onSuccess: () => setTitle("") });
  }

  return (
    <main className="min-h-screen bg-base-200 p-6 text-base-content sm:p-12">
      <section className="card card-border mx-auto max-w-xl bg-base-100">
        <div className="card-body gap-5">
          <div className="navbar flex-col items-start gap-3 rounded-box bg-base-200 sm:flex-row sm:items-center">
            <div className="navbar-start w-auto flex-1">
              <div>
                <h1 className="text-3xl font-semibold">Todos</h1>
                <p className="text-sm text-base-content/70">
                  {workspace.data?.name ?? "当前工作区"}
                  {session.data?.user?.email ? ` · ${session.data.user.email}` : ""}
                </p>
              </div>
            </div>
            <div className="navbar-end w-auto gap-2">
              <Link className="btn btn-ghost btn-sm" to="/workspaces">
                切换工作区
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={() => void signOut()} type="button">
                退出
              </button>
            </div>
          </div>
          <TodoComposer
            disabled={isMutating}
            onSubmit={handleSubmit}
            onTitleChange={setTitle}
            title={title}
          />
          {createTodo.isError || updateTodo.isError || deleteTodo.isError ? (
            <div className="alert alert-error" role="alert">
              操作失败，请稍后重试。
            </div>
          ) : null}
          {todos.isLoading ? (
            <span
              className="loading loading-spinner loading-lg"
              role="status"
              aria-label="正在加载待办事项"
            />
          ) : null}
          {todos.isError ? (
            <div className="alert alert-error" role="alert">
              无法加载待办事项。
            </div>
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
        </div>
      </section>
    </main>
  );
}
