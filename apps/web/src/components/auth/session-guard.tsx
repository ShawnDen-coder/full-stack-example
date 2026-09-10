import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router";
import { authClient } from "../../features/auth/client.js";
import { activeOrganizationId } from "../../features/auth/navigation.js";
import { PageLoading } from "../feedback/page-loading.js";

export function RequireSession({ children }: PropsWithChildren) {
  const session = authClient.useSession();
  const location = useLocation();
  if (session.isPending) return <PageLoading label="正在验证登录状态" />;
  if (!session.data) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate replace to={`/login?returnTo=${encodeURIComponent(returnTo)}`} />;
  }
  return <>{children}</>;
}

export function RequireWorkspace({ children }: PropsWithChildren) {
  const session = authClient.useSession();
  const location = useLocation();
  if (session.isPending || !session.data) return null;
  if (!activeOrganizationId(session.data)) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate replace to={`/workspaces?returnTo=${encodeURIComponent(returnTo)}`} />;
  }
  return <>{children}</>;
}
