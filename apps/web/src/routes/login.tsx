import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { AuthCard } from "../components/auth/auth-card.js";
import { authClient } from "../features/auth/client.js";
import { activeOrganizationId, validateReturnToSearch } from "../features/auth/navigation.js";

export const Route = createFileRoute("/login")({
  validateSearch: validateReturnToSearch,
  beforeLoad: ({ context, search }) => {
    if (context.session)
      throw redirect({
        to: activeOrganizationId(context.session) ? search.returnTo : "/workspaces",
        search: { returnTo: search.returnTo },
      });
  },
  component: LoginPage,
});

export function LoginPage() {
  const session = authClient.useSession();
  const router = useRouter();
  const form = useForm<{ email: string; password: string }>();
  const { returnTo } = Route.useSearch();

  async function submit(values: { email: string; password: string }) {
    const result = await authClient.signIn.email(values);
    if (result.error) return form.setError("root", { message: "邮箱或密码不正确，请重试。" });
    await session.refetch();
    await router.invalidate();
    await router.navigate({ to: returnTo });
  }

  return (
    <AuthCard title="登录">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => void form.handleSubmit(submit)(event)}
      >
        <fieldset className="fieldset gap-3">
          <legend className="fieldset-legend">登录信息</legend>
          <label className="label" htmlFor="login-email">
            邮箱
          </label>
          <input
            className="input w-full"
            id="login-email"
            type="email"
            {...form.register("email", {
              required: "请输入邮箱",
              pattern: { value: /^\S+@\S+$/, message: "请输入有效邮箱" },
            })}
          />
          <label className="label" htmlFor="login-password">
            密码
          </label>
          <input
            className="input w-full"
            id="login-password"
            type="password"
            {...form.register("password", { required: "请输入密码" })}
          />
        </fieldset>
        {form.formState.errors.root ? (
          <div className="alert alert-error" role="alert">
            {form.formState.errors.root.message}
          </div>
        ) : null}
        <div className="card-actions">
          <button
            className="btn btn-primary w-full"
            disabled={form.formState.isSubmitting}
            type="submit"
          >
            登录
          </button>
        </div>
      </form>
      <p>
        还没有账号？{" "}
        <Link className="link" to="/register" search={{ returnTo }}>
          注册
        </Link>
      </p>
    </AuthCard>
  );
}
