import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { PageLoading } from "../components/feedback/page-loading.js";
import { WorkspaceForm } from "../components/workspaces/workspace-form.js";
import { WorkspaceList } from "../components/workspaces/workspace-list.js";
import { authClient } from "../features/auth/client.js";
import { safeReturnTo } from "../features/auth/navigation.js";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function WorkspacesPage() {
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

  if (session.isPending) return <PageLoading label="正在加载工作区" />;
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
      <section className="card card-border mx-auto max-w-xl bg-base-100">
        <div className="card-body gap-6">
          <div>
            <h1 className="card-title text-3xl">选择工作区</h1>
            <p className="text-base-content/70">Todo 数据会按当前工作区隔离。</p>
          </div>
          {organizations.isPending ? (
            <span
              className="loading loading-spinner"
              role="status"
              aria-label="正在加载工作区列表"
            />
          ) : null}
          <WorkspaceList
            disabled={submitting}
            onSelect={(id) => void activate(id)}
            organizations={organizations.data ?? []}
          />
          <div className="divider">或创建一个工作区</div>
          <WorkspaceForm
            disabled={submitting}
            {...(error ? { error } : {})}
            name={name}
            onNameChange={setName}
            onSlugChange={setSlug}
            onSubmit={(event) => void create(event)}
            slug={slug}
          />
        </div>
      </section>
    </main>
  );
}
