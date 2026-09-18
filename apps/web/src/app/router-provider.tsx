import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageLoading } from "../components/shared/page-loading.js";
import { authClient } from "../features/auth/client.js";
import { queryClient } from "../lib/query-client.js";
import { router } from "./router.js";

export function AppRouter() {
  const session = authClient.useSession();
  const [hasResolvedSession, setHasResolvedSession] = useState(!session.isPending);

  useEffect(() => {
    if (!session.isPending) setHasResolvedSession(true);
  }, [session.isPending]);

  if (!hasResolvedSession) return <PageLoading label="正在验证登录状态" />;
  return <RouterProvider router={router} context={{ session: session.data, queryClient }} />;
}
