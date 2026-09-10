import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router";
import { activeOrganizationId, authClient } from "../auth.js";

export function RequireSession({ children }: PropsWithChildren) {
  const session = authClient.useSession();
  const location = useLocation();
  if (session.isPending)
    return (
      <main className="grid min-h-screen place-items-center bg-base-200">
        <span
          className="loading loading-spinner loading-lg"
          role="status"
          aria-label="正在验证登录状态"
        />
      </main>
    );
  if (!session.data) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate replace to={`/login?returnTo=${encodeURIComponent(returnTo)}`} />;
  }
  return <>{children}</>;
}

export function RequireWorkspace({ children }: PropsWithChildren) {
  const session = authClient.useSession();
  const location = useLocation();
  if (session.isPending) return null;
  if (!session.data) return null;
  if (!activeOrganizationId(session.data)) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate replace to={`/workspaces?returnTo=${encodeURIComponent(returnTo)}`} />;
  }
  return <>{children}</>;
}
