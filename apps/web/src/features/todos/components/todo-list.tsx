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
    <ul className="divide-y divide-border rounded-lg border bg-background">
      {todos.map((todo) => (
        <li className="flex items-center gap-3 p-4" key={todo.id}>
          <input
            aria-label={`完成 ${todo.title}`}
            checked={todo.completed}
            className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            disabled={disabled}
            onChange={(event) => onToggle(todo, event.target.checked)}
            type="checkbox"
          />
          <span
            className={todo.completed ? "min-w-0 flex-1 break-words text-muted-foreground line-through" : "min-w-0 flex-1 break-words"}
          >
            {todo.title}
          </span>
          {canDelete ? (
            <Button
              aria-label={`删除 ${todo.title}`}
              disabled={disabled}
              onClick={() => onDelete(todo.id)}
              size="sm"
              type="button"
              variant="destructive"
            >
              删除
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
import { Button } from "../../../components/ui/button.js";
