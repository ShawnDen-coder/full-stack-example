import { Alert, Button, Card, CardContent, CardHeader } from "@mui/material";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../../auth/client.js";
import { useWorkspaceTransition } from "../use-workspace-transition.js";
import { WorkspaceFlowLayout } from "../../../components/shared/workspace-flow-layout.js";
import { WorkspaceForm } from "./workspace-form.js";

export function CreateWorkspacePage({ returnTo }: { readonly returnTo: string }) {
  const session = authClient.useSession();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [pendingActivationId, setPendingActivationId] = useState<string>();
  const { activate, switching, error: transitionError } = useWorkspaceTransition();

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
    const activated = await activate(result.data.id);
    if (!activated) {
      setPendingActivationId(result.data.id);
      setSubmitting(false);
      return;
    }
    setPendingActivationId(undefined);
    reset();
    setSubmitting(false);
    await router.navigate({ to: returnTo });
  }

  async function retryActivation() {
    if (!pendingActivationId) return;
    setSubmitting(true);
    if (await activate(pendingActivationId)) {
      setPendingActivationId(undefined);
      await router.navigate({ to: returnTo });
    }
    setSubmitting(false);
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
          {transitionError ? (
            <Alert severity="error" role="alert" sx={{ mb: 2 }}>
              {transitionError}
              {pendingActivationId ? (
                <Button size="small" onClick={() => void retryActivation()} disabled={switching}>
                  重试切换
                </Button>
              ) : null}
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
