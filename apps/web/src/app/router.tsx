import { createRouter, RouterProvider } from "@tanstack/react-router";
import { PageLoading } from "../components/feedback/page-loading.js";
import { authClient } from "../features/auth/client.js";
import { routeTree } from "../routeTree.gen.js";

export const router = createRouter({ routeTree, context: { session: null } });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  const session = authClient.useSession();
  if (session.isPending) return <PageLoading label="正在验证登录状态" />;
  return <RouterProvider router={router} context={{ session: session.data }} />;
}
