import { useForm } from "react-hook-form";
import { Alert } from "@mui/material";
import { Button, Typography } from "@mui/material";
import { TextField as Input } from "@mui/material";


type Values = { name: string; slug: string };
export function WorkspaceForm({
  disabled,
  error,
  onSubmit,
}: {
  readonly disabled: boolean;
  readonly error?: string;
  readonly onSubmit: (values: Values, reset: () => void) => void;
}) {
  const form = useForm<Values>({ defaultValues: { name: "", slug: "" } });
  const name = form.watch("name");
  const slug = form.watch("slug");
  // 标识默认从名称生成，但用户手动修改后不再覆盖。
  if (name && (!slug || slug === slugify(name)))
    form.setValue("slug", slugify(name), { shouldValidate: true });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) =>
        void form.handleSubmit((values) => onSubmit(values, () => form.reset()))(event)
      }
    >
      <fieldset className="grid gap-4">
        <legend className="text-base font-medium">创建工作区</legend>
        <Typography component="label" htmlFor="workspace-name">名称</Typography>
        <Input
          autoComplete="organization"
          disabled={disabled}
          id="workspace-name"
          {...form.register("name", { required: "请输入名称" })}
        />
        <Typography component="label" htmlFor="workspace-slug">标识</Typography>
        <Input
          autoComplete="off"
          disabled={disabled}
          id="workspace-slug"
          {...form.register("slug", {
            required: "请填写工作区标识",
            pattern: { value: /^[a-z0-9-]+$/, message: "只能包含小写字母、数字和连字符" },
          })}
          onChange={(event) => {
            const value = event.target.value.toLowerCase();
            event.target.value = value;
            form.setValue("slug", value, { shouldDirty: true, shouldValidate: true });
          }}
        />
      </fieldset>
      {error ? (
        <Alert role="alert">
          {error}
        </Alert>
      ) : null}
      <Button className="w-full" disabled={disabled || form.formState.isSubmitting} type="submit">
        创建并继续
      </Button>
    </form>
  );
}
function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}









