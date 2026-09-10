import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { authClient, safeReturnTo } from "../auth.js";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function Workspaces() {
  const session = authClient.useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const organizations = authClient.useListOrganizations();
  const returnTo = safeReturnTo(new URLSearchParams(location.search).get("returnTo"));

  useEffect(() => {
    if (!slug || slug === slugify(name)) setSlug(slugify(name));
  }, [name, slug]);

  if (session.isPending)
    return (
      <main className="grid min-h-screen place-items-center bg-base-200">
        <span className="loading loading-spinner loading-lg" role="status" />
      </main>
    );
  if (!session.data)
    return <Navigate replace to={`/login?returnTo=${encodeURIComponent(returnTo)}`} />;

  async function activate(organizationId: string) {
    setError(undefined);
    setSubmitting(true);
    const result = await authClient.organization.setActive({ organizationId });
    setSubmitting(false);
    if (result.error) return setError("无法切换工作区，请重试。");
    await session.refetch();
    await queryClient.removeQueries({ queryKey: ["todos"] });
    navigate(returnTo);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slug) return setError("请填写工作区标识。");
    setError(undefined);
    setSubmitting(true);
    const result = await authClient.organization.create({ name: name.trim(), slug });
    if (result.error || !result.data) {
      setSubmitting(false);
      return setError("无法创建工作区；名称或标识可能已被使用。");
    }
    await authClient.organization.setActive({ organizationId: result.data.id });
    setSubmitting(false);
    await session.refetch();
    await queryClient.removeQueries({ queryKey: ["todos"] });
    navigate(returnTo);
  }

  return (
    <main className="min-h-screen bg-base-200 p-6 text-base-content sm:p-12">
      <section className="card mx-auto max-w-xl bg-base-100 shadow-xl">
        <div className="card-body gap-6">
          <div>
            <h1 className="card-title text-3xl">选择工作区</h1>
            <p className="opacity-70">Todo 数据会按当前工作区隔离。</p>
          </div>
          {organizations.isPending ? (
            <span className="loading loading-spinner" role="status" />
          ) : null}
          {organizations.data?.map((organization) => (
            <button
              className="btn btn-outline justify-between"
              disabled={submitting}
              key={organization.id}
              onClick={() => void activate(organization.id)}
              type="button"
            >
              <span>{organization.name}</span>
              <span className="opacity-60">{organization.slug}</span>
            </button>
          ))}
          <div className="divider">创建工作区</div>
          <form className="flex flex-col gap-4" onSubmit={(event) => void create(event)}>
            <label className="form-control gap-2">
              <span>名称</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label className="form-control gap-2">
              <span>标识</span>
              <input
                className="input"
                pattern="[a-z0-9-]+"
                value={slug}
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
                required
              />
            </label>
            {error ? (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            ) : null}
            <button className="btn btn-primary" disabled={submitting} type="submit">
              创建并继续
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
