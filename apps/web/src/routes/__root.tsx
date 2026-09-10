import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import type { AppSession } from "../features/auth/client.js";

export type RouterContext = { readonly session: AppSession | null };

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <main className="hero min-h-screen bg-base-200 text-base-content">
      <div className="hero-content text-center">
        <div>
          <h1 className="text-4xl font-bold">页面不存在</h1>
          <Link className="btn btn-primary mt-4" to="/">
            返回首页
          </Link>
        </div>
      </div>
    </main>
  ),
});
