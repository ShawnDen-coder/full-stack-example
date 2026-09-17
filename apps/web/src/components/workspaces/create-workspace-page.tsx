import { Alert, Button, Card, CardContent, CardHeader } from "@mui/material";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../../features/auth/client.js";
import { WorkspaceFlowLayout } from "../shared/workspace-flow-layout.js";
import { WorkspaceForm } from "./workspace-form.js";

export function CreateWorkspacePage({ returnTo }: { readonly returnTo: string }) {
  const session = authClient.useSession();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  if (session.isPending || !session.data) return null;

  async function create({ name }: { readonly name: string }, reset: () => void) {
    setError(undefined);
    setSubmitting(true);
    const result = await authClient.organization.create({
      name: name.trim(),
      slug: workspaceSlug(name),
    });
    if (result.error || !result.data) {
      setSubmitting(false);
      setError("无法创建工作区；名称可能已被使用。");
      return;
    }
    const active = await authClient.organization.setActive({ organizationId: result.data.id });
    if (active.error) {
      setSubmitting(false);
      setError("无法切换工作区，请重试。");
      return;
    }
    await session.refetch();
    await router.invalidate();
    reset();
    setSubmitting(false);
    await router.navigate({ to: returnTo });
  }

  return (
    <WorkspaceFlowLayout account={session.data.user?.name ?? session.data.user?.email}>
      <Card sx={{ width: "100%", maxWidth: 576 }}>
        <CardHeader title="创建工作区" subheader="为团队或项目建立一个共享空间。" />
        <CardContent>
          {error ? (
            <Alert severity="error" role="alert" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}
          <WorkspaceForm
            disabled={submitting}
            onSubmit={(values, reset) => void create(values, reset)}
          />
          <Link
            to="/workspaces"
            search={{ returnTo }}
            style={{ display: "block", textDecoration: "none" }}
          >
            <Button fullWidth variant="outlined" sx={{ mt: 1.5 }}>
              返回工作区列表
            </Button>
          </Link>
        </CardContent>
      </Card>
    </WorkspaceFlowLayout>
  );
}

function workspaceSlug(name: string) {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "workspace";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
