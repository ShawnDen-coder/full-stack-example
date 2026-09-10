import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { authClient } from "../auth.js";
import { useCreateTodo, useDeleteTodo, useTodos, useUpdateTodo } from "../features/todos/api.js";

export function Todos() {
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
      <section className="card mx-auto max-w-xl bg-base-100 shadow-xl">
        <div className="card-body gap-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="card-title text-3xl">Todos</h1>
              <p className="text-sm opacity-70">
                {workspace.data?.name ?? "当前工作区"}
                {session.data?.user?.email ? ` · ${session.data.user.email}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Link className="btn btn-ghost btn-sm" to="/workspaces">
                切换工作区
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={() => void signOut()} type="button">
                退出
              </button>
            </div>
          </div>
          <form className="join w-full" onSubmit={handleSubmit}>
            <input
              className="input join-item w-full"
              disabled={isMutating}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="添加一个待办事项"
              value={title}
            />
            <button
              className="btn btn-primary join-item"
              disabled={isMutating || title.trim().length === 0}
              type="submit"
            >
              添加
            </button>
          </form>
          {createTodo.isError || updateTodo.isError || deleteTodo.isError ? (
            <div className="alert alert-error" role="alert">
              操作失败，请稍后重试。
            </div>
          ) : null}
          {todos.isLoading ? (
            <span className="loading loading-spinner loading-lg" role="status" />
          ) : null}
          {todos.isError ? <div className="alert alert-error">无法加载待办事项。</div> : null}
          {todos.data?.todos.length === 0 ? <p>还没有待办事项。</p> : null}
          {todos.data?.todos.length ? (
            <ul className="flex flex-col gap-2">
              {todos.data.todos.map((todo) => (
                <li className="flex items-center gap-3 rounded-box bg-base-200 p-3" key={todo.id}>
                  <input
                    aria-label={`完成 ${todo.title}`}
                    checked={todo.completed}
                    className="checkbox checkbox-primary"
                    disabled={isMutating}
                    onChange={(event) =>
                      updateTodo.mutate({ id: todo.id, completed: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <span className={todo.completed ? "flex-1 line-through opacity-60" : "flex-1"}>
                    {todo.title}
                  </span>
                  {canDelete ? (
                    <button
                      aria-label={`删除 ${todo.title}`}
                      className="btn btn-error btn-sm"
                      disabled={isMutating}
                      onClick={() => deleteTodo.mutate(todo.id)}
                      type="button"
                    >
                      删除
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </main>
  );
}
