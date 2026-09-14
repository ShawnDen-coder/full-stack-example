import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../client.js";
import { AuthCard } from "../components/auth-card.js";
import { LoginForm } from "../components/login-form.js";

export function LoginPage({ returnTo }: { readonly returnTo: string }) {
  const session = authClient.useSession();
  const router = useRouter();
  const [error, setError] = useState<string>();

  async function submit(values: { email: string; password: string }) {
    setError(undefined);
    try {
      const result = await authClient.signIn.email(values);
      if (result.error) return setError("邮箱或密码不正确，请重试。");
      await session.refetch();
      await router.invalidate();
      await router.navigate({ to: returnTo });
    } catch {
      setError("暂时无法登录，请稍后重试。");
    }
  }

  return (
    <AuthCard description="登录以继续使用你的工作空间。" title="欢迎回来">
      <LoginForm error={error} onSubmit={submit} />
      <p className="text-center text-sm text-muted-foreground">
        还没有账号？{" "}
        <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/register" search={{ returnTo }}>
          注册
        </Link>
      </p>
    </AuthCard>
  );
}
