import { Card, CardContent, CardHeader, Skeleton } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageLoading } from "../../components/shared/page-loading.js";
import { WorkspaceFlowLayout } from "../../components/shared/workspace-flow-layout.js";
import { authClient } from "../../features/auth/client.js";
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
  return (
    <WorkspaceFlowLayout account={session.data.user?.name ?? session.data.user?.email}>
      <Card sx={{ width: "100%", maxWidth: 576 }}>
        <CardHeader title="选择工作区" subheader="选择一个工作区即可继续。" />
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
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <Link
            to="/workspaces/new"
            search={{ returnTo }}
            style={{
              alignSelf: "center",
              fontWeight: 600,
              textDecoration: "none",
              color: "#0a703b",
            }}
          >
            创建工作区
          </Link>
          <p className="text-center text-xs text-slate-500">选择一个工作区继续</p>
        </CardContent>
      </Card>
    </WorkspaceFlowLayout>
  );
}
