import { Button } from "@full-stack-example/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@full-stack-example/ui/components/dialog";
import { Input } from "@full-stack-example/ui/components/input";
import { Label } from "@full-stack-example/ui/components/label";
import { Switch } from "@full-stack-example/ui/components/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@full-stack-example/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { client } from "@/utils/orpc";

export function Workspaces() {
	const [offset, setOffset] = useState(0);
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [email, setEmail] = useState("");
	const [todos, setTodos] = useState(true);
	const queries = useQueryClient();
	const spaces = useQuery({
		queryKey: ["workspaces", "all", offset],
		queryFn: () => client.access.workspaces({ offset }),
	});
	const refresh = async () => {
		await queries.invalidateQueries({ queryKey: ["workspaces"] });
		await queries.invalidateQueries({ queryKey: ["access"] });
	};
	const create = useMutation({
		mutationFn: () =>
			client.access.createWorkspace({
				name,
				slug,
				ownerEmail: email,
				tools: todos ? ["todos"] : [],
			}),
		onSuccess: async () => {
			setOpen(false);
			setName("");
			setSlug("");
			setEmail("");
			await refresh();
			toast.success("Workspace created");
		},
	});
	const toggle = useMutation({
		mutationFn: (input: { workspaceId: string; enabled: boolean }) =>
			client.access.setTool({ ...input, tool: "todos" }),
		onSuccess: refresh,
	});
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4">
				<h1 className="font-semibold text-2xl tracking-tight">Workspaces</h1>
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button>New workspace</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>New workspace</DialogTitle>
							<DialogDescription>
								Assign an existing account as the owner.
							</DialogDescription>
						</DialogHeader>
						<form
							className="space-y-4"
							onSubmit={(event) => {
								event.preventDefault();
								create.mutate();
							}}
						>
							<div className="space-y-2">
								<Label htmlFor="workspace-name">Name</Label>
								<Input
									id="workspace-name"
									value={name}
									onChange={(event) => setName(event.target.value)}
									maxLength={80}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="workspace-slug">Slug</Label>
								<Input
									id="workspace-slug"
									value={slug}
									onChange={(event) => setSlug(event.target.value)}
									pattern="[a-z0-9]+(-[a-z0-9]+)*"
									placeholder="design-team"
									maxLength={80}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="workspace-owner">Owner email</Label>
								<Input
									id="workspace-owner"
									type="email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									required
								/>
							</div>
							<div className="flex items-center justify-between">
								<Label htmlFor="workspace-todos">Todos</Label>
								<Switch
									id="workspace-todos"
									checked={todos}
									onCheckedChange={setTodos}
								/>
							</div>
							<Button className="w-full" disabled={create.isPending}>
								{create.isPending ? "Creating…" : "Create workspace"}
							</Button>
						</form>
					</DialogContent>
				</Dialog>
			</div>
			{spaces.isError ? (
				<p role="alert">
					Unable to load workspaces.{" "}
					<Button variant="link" onClick={() => void spaces.refetch()}>
						Retry
					</Button>
				</p>
			) : spaces.isPending ? (
				<p role="status">Loading workspaces…</p>
			) : (
				<>
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Workspace</TableHead>
									<TableHead>Slug</TableHead>
									<TableHead className="text-right">Todos</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{spaces.data.items.map((space) => (
									<TableRow key={space.id}>
										<TableCell className="max-w-60 truncate font-medium">
											{space.name}
										</TableCell>
										<TableCell className="max-w-40 truncate text-muted-foreground">
											{space.slug}
										</TableCell>
										<TableCell className="text-right">
											<Switch
												aria-label={`Enable Todos in ${space.name}`}
												checked={space.tools.some(
													(tool) => tool.key === "todos" && tool.enabled,
												)}
												disabled={toggle.isPending}
												onCheckedChange={(enabled) =>
													toggle.mutate({ workspaceId: space.id, enabled })
												}
											/>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					{!spaces.data.items.length && (
						<p className="text-muted-foreground text-sm">No workspaces yet.</p>
					)}
					{(offset > 0 || spaces.data.hasMore) && (
						<div className="flex justify-between">
							<Button
								variant="outline"
								disabled={!offset}
								onClick={() => setOffset(offset - 25)}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								disabled={!spaces.data.hasMore}
								onClick={() => setOffset(offset + 25)}
							>
								Next
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
