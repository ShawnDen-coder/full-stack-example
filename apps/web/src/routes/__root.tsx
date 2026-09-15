import { Button } from "@mui/material";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import type { AppSession } from "../features/auth/client.js";

export type RouterContext = {
  readonly session: AppSession | null;
  readonly queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">页面不存在</h1>
        <Link to="/">
          <Button className="mt-4">返回首页</Button>
        </Link>
      </div>
    </main>
  ),
});
