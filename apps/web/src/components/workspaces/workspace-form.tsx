import { Alert, Button, TextField as Input } from "@mui/material";
import { useForm } from "react-hook-form";

export type WorkspaceFormValues = { name: string };

export function WorkspaceForm({
  disabled,
  error,
  onSubmit,
}: {
  readonly disabled: boolean;
  readonly error?: string;
  readonly onSubmit: (values: WorkspaceFormValues, reset: () => void) => void;
}) {
  const form = useForm<WorkspaceFormValues>({ defaultValues: { name: "" } });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) =>
        void form.handleSubmit((values) => onSubmit(values, () => form.reset()))(event)
      }
    >
      <fieldset className="grid gap-3">
        <legend className="text-base font-medium">工作区名称</legend>
        <Input
          autoComplete="organization"
          disabled={disabled}
          id="workspace-name"
          {...form.register("name", { required: "请输入名称" })}
          error={Boolean(form.formState.errors.name)}
          helperText={form.formState.errors.name?.message}
        />
      </fieldset>
      {error ? <Alert role="alert">{error}</Alert> : null}
      <Button className="w-full" disabled={disabled || form.formState.isSubmitting} type="submit">
        创建并继续
      </Button>
    </form>
  );
}
