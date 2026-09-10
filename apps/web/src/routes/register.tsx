import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { activeOrganizationId, authClient, safeReturnTo } from "../auth.js";
import { AuthCard } from "./login.js";

export function Register() {
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
        <label className="form-control gap-2">
          <span>姓名</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label className="form-control gap-2">
          <span>邮箱</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="form-control gap-2">
          <span>密码</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>
        <label className="form-control gap-2">
          <span>确认密码</span>
          <input
            className="input"
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            minLength={8}
            required
          />
        </label>
        {error ? (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        ) : null}
        <button className="btn btn-primary" disabled={submitting} type="submit">
          创建账号
        </button>
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
