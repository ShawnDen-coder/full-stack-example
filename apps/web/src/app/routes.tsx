import { Button } from "@mui/material";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { LoginPage } from "../components/auth/login-page.js";
import { RegisterPage } from "../components/auth/register-page.js";
import { AuthenticatedLayout } from "../components/shared/authenticated-layout.js";
import { HomePage } from "../components/system/home-page.js";
import { TodosPage } from "../components/todos/todos-page.js";
import { CreateWorkspacePage } from "../components/workspaces/create-workspace-page.js";
import { WorkspacesPage } from "../components/workspaces/workspaces-page.js";
import type { AppSession } from "../features/auth/client.js";
import { activeOrganizationId, validateReturnToSearch } from "../features/auth/navigation.js";
import { todosQueryOptions } from "../features/todos/api.js";

export type RouterContext = {
  readonly session: AppSession | null;
  readonly queryClient: QueryClient;
};

export const rootRoute = createRootRouteWithContext<RouterContext>()({
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

export const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authenticated",
  beforeLoad: ({ context, location }) => {
    // 路由守卫只负责 UX，API 仍由服务端会话校验保护。
    if (!context.session) {
      throw redirect({ to: "/login", search: { returnTo: location.href } });
    }
  },
  component: () => <Outlet />,
});

export const appRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  id: "_app",
  component: AuthenticatedLayout,
});

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: validateReturnToSearch,
  beforeLoad: ({ context, search }) => {
    if (context.session) {
      throw redirect({
        to: activeOrganizationId(context.session) ? search.returnTo : "/workspaces",
        search: { returnTo: search.returnTo },
      });
    }
  },
  component: LoginRoutePage,
});

export const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  validateSearch: validateReturnToSearch,
  beforeLoad: ({ context, search }) => {
    if (context.session) {
      throw redirect({
        to: activeOrganizationId(context.session) ? search.returnTo : "/workspaces",
        search: { returnTo: search.returnTo },
      });
    }
  },
  component: RegisterRoutePage,
});

export const workspacesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/workspaces",
  validateSearch: validateReturnToSearch,
  component: WorkspacesRoutePage,
});

export const newWorkspaceRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/workspaces/new",
  validateSearch: validateReturnToSearch,
  component: CreateWorkspaceRoutePage,
});

export const todosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/todos",
  beforeLoad: ({ context, location }) => {
    const organizationId = context.session?.session.activeOrganizationId;
    if (!organizationId) {
      throw redirect({ to: "/workspaces", search: { returnTo: location.href } });
    }
    return { organizationId };
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(todosQueryOptions(context.organizationId)),
  component: TodosRoutePage,
});

function LoginRoutePage() {
  const { returnTo } = loginRoute.useSearch();
  return <LoginPage returnTo={returnTo} />;
}

function RegisterRoutePage() {
  const { returnTo } = registerRoute.useSearch();
  return <RegisterPage returnTo={returnTo} />;
}

function WorkspacesRoutePage() {
  const { returnTo } = workspacesRoute.useSearch();
  return <WorkspacesPage returnTo={returnTo} />;
}

function CreateWorkspaceRoutePage() {
  const { returnTo } = newWorkspaceRoute.useSearch();
  return <CreateWorkspacePage returnTo={returnTo} />;
}

function TodosRoutePage() {
  const { organizationId } = todosRoute.useRouteContext();
  return <TodosPage organizationId={organizationId} />;
}

export const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  registerRoute,
  authenticatedRoute.addChildren([
    workspacesRoute,
    newWorkspaceRoute,
    appRoute.addChildren([todosRoute]),
  ]),
]);
