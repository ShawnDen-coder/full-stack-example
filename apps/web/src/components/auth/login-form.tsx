import { Alert, Button, Stack, TextField } from "@mui/material";
import { useForm } from "react-hook-form";
export type AuthFormStatus = "idle" | "submitting" | "error";
export type LoginValues = { email: string; password: string };
export function LoginForm({ error, status = "idle", onSubmit }: { readonly error?: string | undefined; readonly status?: AuthFormStatus; readonly onSubmit: (values: LoginValues) => void | Promise<void> }) {
  const form = useForm<LoginValues>(); const submitting = status === "submitting" || form.formState.isSubmitting;
  const email = form.register("email", { required: "请输入邮箱", pattern: { value: /^\S+@\S+$/, message: "请输入有效邮箱" } });
  const password = form.register("password", { required: "请输入密码" });
  return <form noValidate onSubmit={(event) => void form.handleSubmit((values) => onSubmit(values))(event)}><Stack spacing={2.5}>
    <TextField {...email} inputRef={email.ref} label="邮箱" type="email" autoComplete="email" error={Boolean(form.formState.errors.email)} helperText={form.formState.errors.email?.message} fullWidth />
    <TextField {...password} inputRef={password.ref} label="密码" type="password" autoComplete="current-password" error={Boolean(form.formState.errors.password)} helperText={form.formState.errors.password?.message} fullWidth />
    {error ? <Alert severity="error">{error}</Alert> : null}
    <Button type="submit" variant="contained" fullWidth loading={submitting} disabled={submitting}>{submitting ? "正在登录…" : "登录"}</Button>
  </Stack></form>;
}









