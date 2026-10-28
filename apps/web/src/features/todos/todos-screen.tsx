import { Button } from "@full-stack-example/ui/components/button";
import { Icon } from "@full-stack-example/ui/components/icon";
import { Input } from "@full-stack-example/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { type client, orpc } from "@/utils/orpc";
import { TodoRow } from "./todo-row";

export function TodosScreen({ userId }: { userId: string | undefined }) {
	const [editingId, setEditingId] = useState<number | null>(null);
	const queryClient = useQueryClient();
	const [newTodoText, setNewTodoText] = useState("");
	const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
	const cursor = cursors.at(-1);
	const queryKey = ["user", userId, "todos"];
	const todos = useQuery({
		...orpc.todo.list.queryOptions({ input: { cursor, limit: 20 } }),
		queryKey: [...queryKey, cursor],
		meta: { errorHandledLocally: true },
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
	const renameMutation = useMutation(
		orpc.todo.rename.mutationOptions({
			retry: false,
			// The editor displays ordinary failures inline; global auth handling still applies.
			onError: () => {},
			onSuccess: async (updated) => {
				queryClient.setQueriesData<
					Awaited<ReturnType<typeof client.todo.list>>
				>({ queryKey }, (page) =>
					page
						? {
								...page,
								items: page.items.map((item) =>
									item.id === updated.id ? updated : item,
								),
							}
						: page,
				);
				await refresh();
			},
		}),
	);
	const busy =
		createMutation.isPending ||
		setCompletedMutation.isPending ||
		deleteMutation.isPending ||
		renameMutation.isPending;
	const navigationLocked = busy || editingId !== null;
	const handleAddTodo = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!navigationLocked && newTodoText.trim())
			createMutation.mutate({ text: newTodoText });
	};
	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-3xl tracking-tight">Todos</h1>
				<p className="text-muted-foreground">Manage your personal tasks.</p>
			</div>
			<div>
				<form onSubmit={handleAddTodo} className="mb-6 flex items-center gap-2">
					<Input
						aria-label="New task"
						value={newTodoText}
						onChange={(event) => setNewTodoText(event.target.value)}
						maxLength={500}
						placeholder="Add a new task..."
						disabled={navigationLocked}
					/>
					<Button
						type="submit"
						disabled={navigationLocked || !newTodoText.trim()}
					>
						{createMutation.isPending ? "Adding..." : "Add"}
					</Button>
				</form>
				{todos.isError && todos.data && (
					<div role="alert" className="mb-4 space-y-2">
						<p>
							Unable to refresh your tasks. Showing previously loaded tasks.
						</p>
						<Button
							variant="outline"
							disabled={todos.isFetching}
							onClick={() => void todos.refetch()}
						>
							{todos.isFetching ? "Retrying..." : "Retry"}
						</Button>
					</div>
				)}
				{todos.isPending ? (
					<div role="status">
						<Icon icon={Loader2} size="status" className="animate-spin" />
						<span className="sr-only">Loading tasks</span>
					</div>
				) : !todos.data ? (
					<div role="alert">
						<p>Unable to load your tasks.</p>
						<Button
							disabled={todos.isFetching}
							onClick={() => void todos.refetch()}
						>
							{todos.isFetching ? "Retrying..." : "Retry"}
						</Button>
					</div>
				) : todos.data.items.length === 0 ? (
					<p className="py-4 text-center">No todos yet. Add one above!</p>
				) : (
					<ul className="divide-y rounded-md border">
						{todos.data.items.map((todo) => (
							<TodoRow
								key={todo.id}
								todo={todo}
								busy={busy}
								editing={editingId === todo.id}
								editingAnother={editingId !== null && editingId !== todo.id}
								onEdit={() => setEditingId(todo.id)}
								onClose={() => setEditingId(null)}
								onRename={async (text) => {
									await renameMutation.mutateAsync({ id: todo.id, text });
								}}
								onCompleted={() =>
									setCompletedMutation.mutate({
										id: todo.id,
										completed: !todo.completed,
									})
								}
								onDelete={() => deleteMutation.mutate({ id: todo.id })}
							/>
						))}
					</ul>
				)}
				<div className="mt-6 flex justify-between">
					<Button
						variant="outline"
						disabled={cursors.length === 1 || navigationLocked}
						onClick={() => setCursors((values) => values.slice(0, -1))}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						disabled={
							!todos.data?.nextCursor || navigationLocked || todos.isFetching
						}
						onClick={() => {
							const next = todos.data?.nextCursor;
							if (next) setCursors((values) => [...values, next]);
						}}
					>
						Next
					</Button>
				</div>
			</div>
		</div>
	);
}
