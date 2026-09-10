export type TodoListItem = {
  readonly id: number;
  readonly title: string;
  readonly completed: boolean;
};

export function TodoList({
  canDelete,
  disabled,
  onDelete,
  onToggle,
  todos,
}: {
  readonly canDelete: boolean;
  readonly disabled: boolean;
  readonly onDelete: (id: number) => void;
  readonly onToggle: (todo: TodoListItem, completed: boolean) => void;
  readonly todos: readonly TodoListItem[];
}) {
  if (todos.length === 0) return <p>还没有待办事项。</p>;

  return (
    <ul className="list rounded-box bg-base-200">
      {todos.map((todo) => (
        <li className="list-row" key={todo.id}>
          <input
            aria-label={`完成 ${todo.title}`}
            checked={todo.completed}
            className="checkbox checkbox-primary"
            disabled={disabled}
            onChange={(event) => onToggle(todo, event.target.checked)}
            type="checkbox"
          />
          <span
            className={todo.completed ? "list-col-grow line-through opacity-60" : "list-col-grow"}
          >
            {todo.title}
          </span>
          {canDelete ? (
            <button
              aria-label={`删除 ${todo.title}`}
              className="btn btn-error btn-soft btn-sm"
              disabled={disabled}
              onClick={() => onDelete(todo.id)}
              type="button"
            >
              删除
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
