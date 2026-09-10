import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { AuthCard } from "../components/auth/auth-card.js";
import { authClient } from "../features/auth/client.js";
import { activeOrganizationId, safeReturnTo } from "../features/auth/navigation.js";

export function RegisterPage() {
  const session = authClient.useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const returnTo = safeReturnTo(new URLSearchParams(location.search).get("returnTo"));

  if (!session.isPending && session.data)
    return <Navigate replace to={activeOrganizationId(session.data) ? returnTo : "/workspaces"} />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) return setError("两次输入的密码不一致。");
    setError(undefined);
    setSubmitting(true);
    const result = await authClient.signUp.email({ name: name.trim(), email, password });
    setSubmitting(false);
    if (result.error) return setError("无法完成注册，请检查输入后重试。");
    await session.refetch();
    navigate(`/workspaces?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return (
    <AuthCard title="注册">
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <fieldset className="fieldset gap-3">
          <legend className="fieldset-legend">注册信息</legend>
          <label className="label" htmlFor="register-name">
            姓名
          </label>
          <input
            className="input w-full"
            id="register-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <label className="label" htmlFor="register-email">
            邮箱
          </label>
          <input
            className="input w-full"
            id="register-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label className="label" htmlFor="register-password">
            密码
          </label>
          <input
            className="input w-full"
            id="register-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          <label className="label" htmlFor="register-confirmation">
            确认密码
          </label>
          <input
            className="input w-full"
            id="register-confirmation"
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            minLength={8}
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
            创建账号
          </button>
        </div>
      </form>
      <p>
        已有账号？{" "}
        <Link className="link" to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
          登录
        </Link>
      </p>
    </AuthCard>
  );
}
