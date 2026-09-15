import { Card, CardContent, CardHeader, Divider as Separator, Skeleton } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageLoading } from "../../components/shared/page-loading.js";
import { authClient } from "../../features/auth/client.js";
import { WorkspaceForm } from "./workspace-form.js";
import { WorkspaceList } from "./workspace-list.js";

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
    <main id="main-content" className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6">
      <Card className="mx-auto max-w-xl">
        <CardHeader title="选择工作区" subheader="Todo 数据会按当前工作区隔离。" />
        <CardContent className="grid gap-5">
          {organizations.isPending ? (
            <div aria-label="正在加载工作区列表" className="grid gap-3" role="status">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : null}
          <WorkspaceList
            disabled={submitting}
            onSelect={(id) => void activate(id)}
            organizations={organizations.data ?? []}
          />
          <div className="flex items-center gap-3 text-xs">
            <Separator className="flex-1" />
            <span>或创建一个工作区</span>
            <Separator className="flex-1" />
          </div>
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
