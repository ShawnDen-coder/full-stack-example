import { useForm } from "react-hook-form";
import { Alert } from "../../../components/ui/alert.js";
import { Button } from "../../../components/ui/button.js";
import { Field, FieldError, FieldLabel } from "../../../components/ui/field.js";
import { Input } from "../../../components/ui/input.js";
import type { AuthFormStatus } from "./login-form.js";

export type RegisterValues = {
  name: string;
  email: string;
  password: string;
  confirmation: string;
};

export function RegisterForm({
  error,
  status = "idle",
  onSubmit,
}: {
  readonly error?: string | undefined;
  readonly status?: AuthFormStatus | undefined;
  readonly onSubmit: (values: RegisterValues) => void | Promise<void>;
}) {
  const form = useForm<RegisterValues>();
  const errors = form.formState.errors;
  const submitting = status === "submitting" || form.formState.isSubmitting;

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => void form.handleSubmit((values) => onSubmit(values))(event)}
    >
      <div className="grid gap-4">
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="register-name">姓名</FieldLabel>
          <Input
            autoComplete="name"
            aria-describedby={errors.name ? "register-name-error" : undefined}
            aria-invalid={Boolean(errors.name)}
            id="register-name"
            {...form.register("name", { required: "请输入姓名" })}
          />
          <FieldError id="register-name-error">{errors.name?.message}</FieldError>
        </Field>
        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="register-email">邮箱</FieldLabel>
          <Input
            autoComplete="email"
            aria-describedby={errors.email ? "register-email-error" : undefined}
            aria-invalid={Boolean(errors.email)}
            id="register-email"
            type="email"
            {...form.register("email", {
              required: "请输入邮箱",
              pattern: { value: /^\S+@\S+$/, message: "请输入有效邮箱" },
            })}
          />
          <FieldError id="register-email-error">{errors.email?.message}</FieldError>
        </Field>
        <Field data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="register-password">密码</FieldLabel>
          <Input
            autoComplete="new-password"
            aria-describedby={errors.password ? "register-password-error" : undefined}
            aria-invalid={Boolean(errors.password)}
            id="register-password"
            type="password"
            {...form.register("password", {
              required: "请输入密码",
              minLength: { value: 8, message: "密码至少 8 位" },
            })}
          />
          <FieldError id="register-password-error">{errors.password?.message}</FieldError>
        </Field>
        <Field data-invalid={errors.confirmation ? true : undefined}>
          <FieldLabel htmlFor="register-confirmation">确认密码</FieldLabel>
          <Input
            autoComplete="new-password"
            aria-describedby={errors.confirmation ? "register-confirmation-error" : undefined}
            aria-invalid={Boolean(errors.confirmation)}
            id="register-confirmation"
            type="password"
            {...form.register("confirmation", {
              required: "请确认密码",
              validate: (value) => value === form.getValues("password") || "两次输入的密码不一致。",
            })}
          />
          <FieldError id="register-confirmation-error">{errors.confirmation?.message}</FieldError>
        </Field>
      </div>
      {error ? (
        <Alert className="border-destructive/40 text-destructive" role="alert">
          {error}
        </Alert>
      ) : null}
      <Button className="w-full" disabled={submitting} type="submit">
        {submitting ? "正在创建账号…" : "创建账号"}
      </Button>
    </form>
  );
}
