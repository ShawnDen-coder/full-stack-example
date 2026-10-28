import { createFileRoute } from "@tanstack/react-router";
import { TodosScreen } from "@/features/todos/todos-screen";

export const Route = createFileRoute("/_auth/todos")({ component: TodosRoute });

function TodosRoute() {
	const { session } = Route.useRouteContext();
	return (
		<TodosScreen key={session.data?.user.id} userId={session.data?.user.id} />
	);
}
