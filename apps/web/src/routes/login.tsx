import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { activeOrganizationId, authClient, safeReturnTo } from "../auth.js";

export function Login() {
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
            required
          />
        </label>
        {error ? (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        ) : null}
        <button className="btn btn-primary" disabled={submitting} type="submit">
          登录
        </button>
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

export function AuthCard({
  children,
  title,
}: {
  readonly children: React.ReactNode;
  readonly title: string;
}) {
  return (
    <main className="min-h-screen bg-base-200 p-6 sm:p-12">
      <section className="card mx-auto max-w-md bg-base-100 shadow-xl">
        <div className="card-body gap-5">
          <h1 className="card-title text-3xl">{title}</h1>
          {children}
        </div>
      </section>
    </main>
  );
}
