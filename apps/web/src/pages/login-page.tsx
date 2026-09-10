import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { AuthCard } from "../components/auth/auth-card.js";
import { authClient } from "../features/auth/client.js";
import { activeOrganizationId, safeReturnTo } from "../features/auth/navigation.js";

export function LoginPage() {
  const session = authClient.useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const returnTo = safeReturnTo(new URLSearchParams(location.search).get("returnTo"));

  if (!session.isPending && session.data)
    return <Navigate replace to={activeOrganizationId(session.data) ? returnTo : "/workspaces"} />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);
    const result = await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (result.error) return setError("邮箱或密码不正确，请重试。");
    await session.refetch();
    navigate(returnTo);
  }

  return (
    <AuthCard title="登录">
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <fieldset className="fieldset gap-3">
          <legend className="fieldset-legend">登录信息</legend>
          <label className="label" htmlFor="login-email">
            邮箱
          </label>
          <input
            className="input w-full"
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label className="label" htmlFor="login-password">
            密码
          </label>
          <input
            className="input w-full"
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </fieldset>
        {error ? (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="card-actions">
          <button className="btn btn-primary w-full" disabled={submitting} type="submit">
            登录
          </button>
        </div>
      </form>
      <p>
        还没有账号？{" "}
        <Link className="link" to={`/register?returnTo=${encodeURIComponent(returnTo)}`}>
          注册
        </Link>
      </p>
    </AuthCard>
  );
}
