import { useForm } from "react-hook-form";
import { Alert } from "../../../components/ui/alert.js";
import { Button } from "../../../components/ui/button.js";
import { Field, FieldError, FieldLabel } from "../../../components/ui/field.js";
import { Input } from "../../../components/ui/input.js";

export type AuthFormStatus = "idle" | "submitting" | "error";

export type LoginValues = { email: string; password: string };

export function LoginForm({
  error,
  status = "idle",
  onSubmit,
}: {
  readonly error?: string | undefined;
  readonly status?: AuthFormStatus | undefined;
  readonly onSubmit: (values: LoginValues) => void | Promise<void>;
}) {
  const form = useForm<LoginValues>();
  const errors = form.formState.errors;
  const submitting = status === "submitting" || form.formState.isSubmitting;

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => void form.handleSubmit((values) => onSubmit(values))(event)}
    >
      <div className="grid gap-4">
        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="login-email">邮箱</FieldLabel>
          <Input
            autoComplete="email"
            aria-describedby={errors.email ? "login-email-error" : undefined}
            aria-invalid={Boolean(errors.email)}
            id="login-email"
            type="email"
            {...form.register("email", {
              required: "请输入邮箱",
              pattern: { value: /^\S+@\S+$/, message: "请输入有效邮箱" },
            })}
          />
          <FieldError id="login-email-error">{errors.email?.message}</FieldError>
        </Field>
        <Field data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="login-password">密码</FieldLabel>
          <Input
            autoComplete="current-password"
            aria-describedby={errors.password ? "login-password-error" : undefined}
            aria-invalid={Boolean(errors.password)}
            id="login-password"
            type="password"
            {...form.register("password", { required: "请输入密码" })}
          />
          <FieldError id="login-password-error">{errors.password?.message}</FieldError>
        </Field>
      </div>
      {error ? (
        <Alert className="border-destructive/40 text-destructive" role="alert">
          {error}
        </Alert>
      ) : null}
      <Button className="w-full" disabled={submitting} type="submit">
        {submitting ? "正在登录…" : "登录"}
      </Button>
    </form>
  );
}
