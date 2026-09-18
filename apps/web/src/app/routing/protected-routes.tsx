import { createRoute, Outlet, redirect } from "@tanstack/react-router";
import { CreateWorkspacePage } from "../../components/workspaces/create-workspace-page.js";
import { WorkspacesPage } from "../../components/workspaces/workspaces-page.js";
import { validateReturnToSearch } from "../../features/auth/navigation.js";
import { rootRoute } from "./root-route.js";

export const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authenticated",
  beforeLoad: ({ context, location }) => {
    if (!context.session) {
      throw redirect({ to: "/login", search: { returnTo: location.href } });
    }
    return { session: context.session };
  },
  component: AuthenticatedRouteOutlet,
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

function AuthenticatedRouteOutlet() {
  return <Outlet />;
}

function WorkspacesRoutePage() {
  const { returnTo } = workspacesRoute.useSearch();
  return <WorkspacesPage returnTo={returnTo} />;
}

function CreateWorkspaceRoutePage() {
  const { returnTo } = newWorkspaceRoute.useSearch();
  return <CreateWorkspacePage returnTo={returnTo} />;
}
