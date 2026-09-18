import { createRouter, RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageLoading } from "../components/shared/page-loading.js";
import { authClient } from "../features/auth/client.js";
import { queryClient } from "../lib/query-client.js";
import { routeTree } from "../routeTree.gen.js";

export const router = createRouter({ routeTree, context: { session: null, queryClient } });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  const session = authClient.useSession();
  const [hasResolvedSession, setHasResolvedSession] = useState(!session.isPending);

  useEffect(() => {
    if (!session.isPending) setHasResolvedSession(true);
  }, [session.isPending]);

  if (!hasResolvedSession) return <PageLoading label="正在验证登录状态" />;
  return <RouterProvider router={router} context={{ session: session.data, queryClient }} />;
}
