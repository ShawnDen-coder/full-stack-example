import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageLoading } from "../../../components/feedback/page-loading.js";
import { authClient } from "../../auth/client.js";
import { WorkspaceForm } from "../components/workspace-form.js";
import { WorkspaceList } from "../components/workspace-list.js";
export function WorkspacesPage({ returnTo }: { readonly returnTo: string }) {
  const session = authClient.useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const organizations = authClient.useListOrganizations();
  if (session.isPending) return <PageLoading label="正在加载工作区" />;
  if (!session.data) return null;
  async function activate(organizationId: string) {
    setError(undefined);
    setSubmitting(true);
    const result = await authClient.organization.setActive({ organizationId });
    setSubmitting(false);
    if (result.error) return setError("无法切换工作区，请重试。");
    await session.refetch();
    await queryClient.removeQueries({ queryKey: ["todos"] });
    await router.invalidate();
    await router.navigate({ to: returnTo });
  }
  async function create(values: { name: string; slug: string }, reset: () => void) {
    setError(undefined);
    setSubmitting(true);
    const result = await authClient.organization.create({
      name: values.name.trim(),
      slug: values.slug,
    });
    if (result.error || !result.data) {
      setSubmitting(false);
      return setError("无法创建工作区；名称或标识可能已被使用。");
    }
    const active = await authClient.organization.setActive({ organizationId: result.data.id });
    if (active.error) {
      setSubmitting(false);
      return setError("无法切换工作区，请重试。");
    }
    await session.refetch();
    await queryClient.removeQueries({ queryKey: ["todos"] });
    setSubmitting(false);
    reset();
    await router.invalidate();
    await router.navigate({ to: returnTo });
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
            onSubmit={(values, reset) => void create(values, reset)}
          />
        </div>
      </section>
    </main>
  );
}
