import { createRoute, redirect } from "@tanstack/react-router";
import { AuthenticatedLayout } from "../../components/shared/authenticated-layout.js";
import { TodosPage } from "../../components/todos/todos-page.js";
import { todosQueryOptions } from "../../features/todos/api.js";
import { authenticatedRoute } from "./protected-routes.js";

export const workspaceRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  id: "_app",
  component: AuthenticatedLayout,
});

export const todosRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "/todos",
  beforeLoad: ({ context, location }) => {
    const organizationId = context.session.session.activeOrganizationId;
    if (!organizationId) {
      throw redirect({ to: "/workspaces", search: { returnTo: location.href } });
    }
    return { organizationId };
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(todosQueryOptions(context.organizationId));
  },
  component: TodosRoutePage,
});

function TodosRoutePage() {
  const { organizationId } = todosRoute.useRouteContext();
  return <TodosPage organizationId={organizationId} />;
}
