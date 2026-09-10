import type { FormEvent } from "react";

export function TodoComposer({
  disabled,
  onSubmit,
  onTitleChange,
  title,
}: {
  readonly disabled: boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onTitleChange: (title: string) => void;
  readonly title: string;
}) {
  return (
    <form className="join w-full" onSubmit={onSubmit}>
      <input
        className="input join-item w-full"
        disabled={disabled}
        maxLength={200}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="添加一个待办事项"
        value={title}
      />
      <button
        className="btn btn-primary join-item"
        disabled={disabled || title.trim().length === 0}
        type="submit"
      >
        添加
      </button>
    </form>
  );
}
