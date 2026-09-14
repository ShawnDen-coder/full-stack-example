import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../client.js";
import { AuthCard } from "../components/auth-card.js";
import { RegisterForm } from "../components/register-form.js";

export function RegisterPage({ returnTo }: { readonly returnTo: string }) {
  const session = authClient.useSession();
  const router = useRouter();
  const [error, setError] = useState<string>();

  async function submit(values: { name: string; email: string; password: string; confirmation: string }) {
    setError(undefined);
    try {
      const result = await authClient.signUp.email({
        name: values.name.trim(),
        email: values.email,
        password: values.password,
      });
      if (result.error) return setError("无法完成注册，请检查输入后重试。");
      await session.refetch();
      await router.invalidate();
      await router.navigate({ to: "/workspaces", search: { returnTo } });
    } catch {
      setError("暂时无法注册，请稍后重试。");
    }
  }

  return (
    <AuthCard description="创建账号，开始管理你的工作空间。" title="创建账号">
      <RegisterForm error={error} onSubmit={submit} />
      <p className="text-center text-sm text-muted-foreground">
        已有账号？{" "}
        <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/login" search={{ returnTo }}>
          登录
        </Link>
      </p>
    </AuthCard>
  );
}
