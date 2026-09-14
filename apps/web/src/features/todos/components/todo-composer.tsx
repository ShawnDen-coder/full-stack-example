import { useForm } from "react-hook-form";
import { Button } from "../../../components/ui/button.js";
import { Input } from "../../../components/ui/input.js";

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
      className="flex w-full gap-2"
      onSubmit={(event) =>
        void form.handleSubmit(({ title }) => onSubmit(title.trim(), () => form.reset()))(event)
      }
    >
      <Input
        aria-label="待办事项标题"
        className="min-w-0 flex-1"
        disabled={disabled}
        maxLength={200}
        placeholder="添加一个待办事项"
        {...form.register("title", {
          required: true,
          validate: (value) => value.trim().length > 0,
        })}
      />
      <Button disabled={disabled || form.formState.isSubmitting} type="submit">
        添加
      </Button>
    </form>
  );
}
