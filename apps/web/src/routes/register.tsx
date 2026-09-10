import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { AuthCard } from "../components/auth/auth-card.js";
import { authClient } from "../features/auth/client.js";
import { activeOrganizationId, validateReturnToSearch } from "../features/auth/navigation.js";

type Values = { name: string; email: string; password: string; confirmation: string };

export const Route = createFileRoute("/register")({
  validateSearch: validateReturnToSearch,
  beforeLoad: ({ context, search }) => {
    if (context.session)
      throw redirect({
        to: activeOrganizationId(context.session) ? search.returnTo : "/workspaces",
        search: { returnTo: search.returnTo },
      });
  },
  component: RegisterPage,
});

export function RegisterPage() {
  const session = authClient.useSession();
  const router = useRouter();
  const form = useForm<Values>();
  const { returnTo } = Route.useSearch();

  async function submit(values: Values) {
    if (values.password !== values.confirmation) {
      form.setError("confirmation", { message: "两次输入的密码不一致。" });
      return;
    }
    const result = await authClient.signUp.email({
      name: values.name.trim(),
      email: values.email,
      password: values.password,
    });
    if (result.error) return form.setError("root", { message: "无法完成注册，请检查输入后重试。" });
    await session.refetch();
    await router.invalidate();
    await router.navigate({ to: "/workspaces", search: { returnTo } });
  }

  return (
    <AuthCard title="注册">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => void form.handleSubmit(submit)(event)}
      >
        <fieldset className="fieldset gap-3">
          <legend className="fieldset-legend">注册信息</legend>
          <label className="label" htmlFor="register-name">
            姓名
          </label>
          <input
            className="input w-full"
            id="register-name"
            {...form.register("name", { required: "请输入姓名" })}
          />
          <label className="label" htmlFor="register-email">
            邮箱
          </label>
          <input
            className="input w-full"
            id="register-email"
            type="email"
            {...form.register("email", { required: "请输入邮箱" })}
          />
          <label className="label" htmlFor="register-password">
            密码
          </label>
          <input
            className="input w-full"
            id="register-password"
            type="password"
            {...form.register("password", {
              required: "请输入密码",
              minLength: { value: 8, message: "密码至少 8 位" },
            })}
          />
          <label className="label" htmlFor="register-confirmation">
            确认密码
          </label>
          <input
            className="input w-full"
            id="register-confirmation"
            type="password"
            {...form.register("confirmation", { required: "请确认密码" })}
          />
        </fieldset>
        {form.formState.errors.root ? (
          <div className="alert alert-error" role="alert">
            {form.formState.errors.root.message}
          </div>
        ) : null}
        <button
          className="btn btn-primary w-full"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          创建账号
        </button>
      </form>
      <p>
        已有账号？{" "}
        <Link className="link" to="/login" search={{ returnTo }}>
          登录
        </Link>
      </p>
    </AuthCard>
  );
}
