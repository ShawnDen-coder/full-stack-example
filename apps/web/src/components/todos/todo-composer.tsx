import { useForm } from "react-hook-form";
export function TodoComposer({
  disabled,
  onSubmit,
}: {
  readonly disabled: boolean;
  readonly onSubmit: (title: string, reset: () => void) => void;
}) {
  const form = useForm<{ title: string }>();
  return (
    <form
      className="join w-full"
      onSubmit={(event) =>
        void form.handleSubmit(({ title }) => onSubmit(title.trim(), () => form.reset()))(event)
      }
    >
      <input
        aria-label="待办事项标题"
        className="input join-item w-full"
        disabled={disabled}
        maxLength={200}
        placeholder="添加一个待办事项"
        {...form.register("title", {
          required: true,
          validate: (value) => value.trim().length > 0,
        })}
      />
      <button
        className="btn btn-primary join-item"
        disabled={disabled || form.formState.isSubmitting}
        type="submit"
      >
        添加
      </button>
    </form>
  );
}
