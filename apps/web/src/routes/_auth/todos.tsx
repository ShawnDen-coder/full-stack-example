import { createFileRoute } from "@tanstack/react-router";
import { TodosScreen } from "@/features/todos/todos-screen";
import { useWorkspaceId } from "@/lib/workspace";

export const Route = createFileRoute("/_auth/todos")({ component: TodosRoute });

function TodosRoute() {
	const workspaceId = useWorkspaceId();
	const { session } = Route.useRouteContext();
	if (!workspaceId) return null;
	return (
		<TodosScreen
			key={`${session.data?.user.id}:${workspaceId}`}
			workspaceId={workspaceId}
			userId={session.data?.user.id}
		/>
	);
}
