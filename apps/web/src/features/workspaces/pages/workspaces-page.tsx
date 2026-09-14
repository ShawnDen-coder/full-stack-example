import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageLoading } from "../../../components/feedback/page-loading.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { ThemeSelect } from "../../../app/theme-provider.js";
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
    <main className="relative min-h-screen bg-background p-4 text-foreground sm:p-10">
      <ThemeSelect className="absolute right-4 top-4 sm:right-8 sm:top-6" />
      <Card className="mx-auto mt-14 max-w-xl">
        <CardHeader>
          <div>
            <CardTitle>选择工作区</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Todo 数据会按当前工作区隔离。</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          {organizations.isPending ? (
            <span
              className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"
              role="status"
              aria-label="正在加载工作区列表"
            />
          ) : null}
          <WorkspaceList
            disabled={submitting}
            onSelect={(id) => void activate(id)}
            organizations={organizations.data ?? []}
          />
          <div className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">或创建一个工作区</div>
          <WorkspaceForm
            disabled={submitting}
            {...(error ? { error } : {})}
            onSubmit={(values, reset) => void create(values, reset)}
          />
        </CardContent>
      </Card>
    </main>
  );
}
