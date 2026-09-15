import { createFileRoute, redirect } from "@tanstack/react-router";
import { TodosPage } from "../../components/todos/todos-page.js";
import { todosQueryOptions } from "../../features/todos/api.js";

export const Route = createFileRoute("/_authenticated/todos")({
  beforeLoad: ({ context, location }) => {
    const organizationId = context.session?.session.activeOrganizationId;
    if (!organizationId) throw redirect({ to: "/workspaces", search: { returnTo: location.href } });
    return { organizationId };
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(todosQueryOptions(context.organizationId)),
  component: TodosRoutePage,
});

function TodosRoutePage() {
  const { organizationId } = Route.useRouteContext();
  return <TodosPage organizationId={organizationId} />;
}
