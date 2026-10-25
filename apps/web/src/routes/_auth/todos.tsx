import { Button } from "@full-stack-example/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@full-stack-example/ui/components/card";
import { Checkbox } from "@full-stack-example/ui/components/checkbox";
import { Input } from "@full-stack-example/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/todos")({ component: TodosRoute });

function TodosRoute() {
	const { session } = Route.useRouteContext();
	const userId = session.data?.user.id;
	const queryClient = useQueryClient();
	const [newTodoText, setNewTodoText] = useState("");
	const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
	const cursor = cursors.at(-1);
	const queryKey = ["user", userId, "todos"];
	const todos = useQuery({
		...orpc.todo.list.queryOptions({ input: { cursor, limit: 20 } }),
		queryKey: [...queryKey, cursor],
	});
	const refresh = async () => {
		await queryClient.invalidateQueries({ queryKey });
	};
	const createMutation = useMutation(
		orpc.todo.create.mutationOptions({
			onSuccess: async () => {
				setNewTodoText("");
				setCursors([undefined]);
				await refresh();
			},
		}),
	);
	const setCompletedMutation = useMutation(
		orpc.todo.setCompleted.mutationOptions({ onSuccess: refresh }),
	);
	const deleteMutation = useMutation(
		orpc.todo.delete.mutationOptions({
			onSuccess: async () => {
				setCursors([undefined]);
				await refresh();
			},
		}),
	);
	const busy =
		createMutation.isPending ||
		setCompletedMutation.isPending ||
		deleteMutation.isPending;
	const handleAddTodo = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (newTodoText.trim()) createMutation.mutate({ text: newTodoText });
	};
	return (
		<div className="mx-auto w-full max-w-md p-4 py-10">
			<Card>
				<CardHeader>
					<CardTitle>Todo List</CardTitle>
					<CardDescription>Manage your personal tasks</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={handleAddTodo}
						className="mb-6 flex items-center gap-2"
					>
						<Input
							aria-label="New task"
							value={newTodoText}
							onChange={(event) => setNewTodoText(event.target.value)}
							maxLength={500}
							placeholder="Add a new task..."
							disabled={busy}
						/>
						<Button type="submit" disabled={busy || !newTodoText.trim()}>
							{createMutation.isPending ? "Adding..." : "Add"}
						</Button>
					</form>
					{todos.isPending ? (
						<div role="status">
							<Loader2 className="h-6 w-6 animate-spin" />
							<span className="sr-only">Loading tasks</span>
						</div>
					) : todos.isError ? (
						<div role="alert">
							<p>Unable to load your tasks.</p>
							<Button onClick={() => void todos.refetch()}>Retry</Button>
						</div>
					) : todos.data.items.length === 0 ? (
						<p className="py-4 text-center">No todos yet. Add one above!</p>
					) : (
						<ul className="space-y-2">
							{todos.data.items.map((todo) => (
								<li
									key={todo.id}
									className="flex items-center justify-between rounded-md border p-2"
								>
									<div className="flex items-center gap-2">
										<Checkbox
											id={`todo-${todo.id}`}
											checked={todo.completed}
											disabled={busy}
											onCheckedChange={() =>
												setCompletedMutation.mutate({
													id: todo.id,
													completed: !todo.completed,
												})
											}
										/>
										<label
											htmlFor={`todo-${todo.id}`}
											className={todo.completed ? "line-through" : ""}
										>
											{todo.text}
										</label>
									</div>
									<Button
										variant="ghost"
										size="icon"
										aria-label={`Delete ${todo.text}`}
										disabled={busy}
										onClick={() => deleteMutation.mutate({ id: todo.id })}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</li>
							))}
						</ul>
					)}
					<div className="mt-6 flex justify-between">
						<Button
							variant="outline"
							disabled={cursors.length === 1 || busy}
							onClick={() => setCursors((values) => values.slice(0, -1))}
						>
							Previous
						</Button>
						<Button
							variant="outline"
							disabled={!todos.data?.nextCursor || busy || todos.isFetching}
							onClick={() => {
								const next = todos.data?.nextCursor;
								if (next) setCursors((values) => [...values, next]);
							}}
						>
							Next
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
