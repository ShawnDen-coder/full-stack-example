import { useForm } from "react-hook-form";
import { Alert } from "../../../components/ui/alert.js";
import { Button } from "../../../components/ui/button.js";
import { Input } from "../../../components/ui/input.js";
import { Label } from "../../../components/ui/label.js";

export type RegisterValues = {
  name: string;
  email: string;
  password: string;
  confirmation: string;
};

export function RegisterForm({
  error,
  isSubmitting = false,
  onSubmit,
}: {
  readonly error?: string | undefined;
  readonly isSubmitting?: boolean | undefined;
  readonly onSubmit: (values: RegisterValues) => void | Promise<void>;
}) {
  const form = useForm<RegisterValues>();
  const errors = form.formState.errors;

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="register-name">姓名</Label>
          <Input
            autoComplete="name"
            aria-describedby={errors.name ? "register-name-error" : undefined}
            aria-invalid={Boolean(errors.name)}
            id="register-name"
            {...form.register("name", { required: "请输入姓名" })}
          />
          {errors.name ? (
            <p className="text-sm text-destructive" id="register-name-error">
              {errors.name.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-email">邮箱</Label>
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
          {errors.email ? (
            <p className="text-sm text-destructive" id="register-email-error">
              {errors.email.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-password">密码</Label>
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
          {errors.password ? (
            <p className="text-sm text-destructive" id="register-password-error">
              {errors.password.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-confirmation">确认密码</Label>
          <Input
            autoComplete="new-password"
            aria-describedby={errors.confirmation ? "register-confirmation-error" : undefined}
            aria-invalid={Boolean(errors.confirmation)}
            id="register-confirmation"
            type="password"
            {...form.register("confirmation", {
              required: "请确认密码",
              validate: (value) =>
                value === form.getValues("password") || "两次输入的密码不一致。",
            })}
          />
          {errors.confirmation ? (
            <p className="text-sm text-destructive" id="register-confirmation-error">
              {errors.confirmation.message}
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
        {isSubmitting || form.formState.isSubmitting ? "正在创建账号…" : "创建账号"}
      </Button>
    </form>
  );
}
