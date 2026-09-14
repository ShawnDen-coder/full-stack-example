import { useForm } from "react-hook-form";
import { Alert } from "../../../components/ui/alert.js";
import { Button } from "../../../components/ui/button.js";
import { Input } from "../../../components/ui/input.js";
import { Label } from "../../../components/ui/label.js";

export type LoginValues = { email: string; password: string };

export function LoginForm({
  error,
  isSubmitting = false,
  onSubmit,
}: {
  readonly error?: string | undefined;
  readonly isSubmitting?: boolean | undefined;
  readonly onSubmit: (values: LoginValues) => void | Promise<void>;
}) {
  const form = useForm<LoginValues>();
  const errors = form.formState.errors;

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="login-email">邮箱</Label>
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
          {errors.email ? (
            <p className="text-sm text-destructive" id="login-email-error">
              {errors.email.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="login-password">密码</Label>
          <Input
            autoComplete="current-password"
            aria-describedby={errors.password ? "login-password-error" : undefined}
            aria-invalid={Boolean(errors.password)}
            id="login-password"
            type="password"
            {...form.register("password", { required: "请输入密码" })}
          />
          {errors.password ? (
            <p className="text-sm text-destructive" id="login-password-error">
              {errors.password.message}
            </p>
          ) : null}
        </div>
      </div>
      {error ? (
        <Alert className="border-destructive/40 text-destructive" role="alert">
          {error}
        </Alert>
      ) : null}
      <Button className="w-full" disabled={isSubmitting || form.formState.isSubmitting} type="submit">
        {isSubmitting || form.formState.isSubmitting ? "正在登录…" : "登录"}
      </Button>
    </form>
  );
}
