import { Button } from "@full-stack-example/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@full-stack-example/ui/components/dialog";
import { Icon } from "@full-stack-example/ui/components/icon";
import { Input } from "@full-stack-example/ui/components/input";
import { Label } from "@full-stack-example/ui/components/label";
import { Switch } from "@full-stack-example/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { client } from "@/utils/orpc";
import { LogoPreview, prepareLogo, WorkspaceLogo } from "./workspace-logo";
import { WorkspaceSettings } from "./workspace-settings";

export function Workspaces() {
	const [offset, setOffset] = useState(0);
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [email, setEmail] = useState("");
	const [todos, setTodos] = useState(true);
	const [logo, setLogo] = useState<string | null>(null);
	const [logoError, setLogoError] = useState("");
	const [preparing, setPreparing] = useState(false);
	const [selected, setSelected] = useState<string>();
	const settingsTrigger = useRef<HTMLButtonElement>(null);
	const createTrigger = useRef<HTMLButtonElement>(null);
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
				logo,
			}),
		onError: () => {},
		onSuccess: async () => {
			setOpen(false);
			setName("");
			setSlug("");
			setEmail("");
			setTodos(true);
			setLogo(null);
			await refresh();
			toast.success("Workspace created");
		},
	});
	const selectedSpace = spaces.data?.items.find(
		(space) => space.id === selected,
	);
	return (
		<div className="mx-auto w-full max-w-240 space-y-4">
			<div className="flex flex-wrap items-center justify-end gap-2">
				<h1 className="sr-only">Workspaces</h1>
				<Dialog
					open={open}
					onOpenChange={(next) => {
						if (!create.isPending && !preparing) setOpen(next);
					}}
				>
					<DialogTrigger asChild>
						<Button ref={createTrigger}>New workspace</Button>
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
								if (!create.isPending && !preparing) create.mutate();
							}}
						>
							<div className="space-y-2">
								<Label htmlFor="new-logo">Logo (optional)</Label>
								<div className="flex items-center gap-2">
									<LogoPreview name={name} logo={logo} />
									<Input
										id="new-logo"
										disabled={create.isPending || preparing}
										type="file"
										accept="image/png,image/jpeg,image/webp"
										onChange={(event) => {
											const file = event.target.files?.[0];
											event.target.value = "";
											if (!file) return;
											setLogoError("");
											setPreparing(true);
											void prepareLogo(file)
												.then(setLogo, (error: unknown) =>
													setLogoError(
														error instanceof Error
															? error.message
															: "Unable to read image.",
													),
												)
												.finally(() => setPreparing(false));
										}}
									/>
									<Button
										type="button"
										variant="ghost"
										disabled={!logo || create.isPending || preparing}
										onClick={() => setLogo(null)}
									>
										Remove
									</Button>
								</div>
								{logoError && (
									<p role="alert" className="text-destructive text-sm">
										{logoError}
									</p>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="workspace-name">Name</Label>
								<Input
									id="workspace-name"
									disabled={create.isPending || preparing}
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
									disabled={create.isPending || preparing}
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
									disabled={create.isPending || preparing}
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
									disabled={create.isPending || preparing}
									checked={todos}
									onCheckedChange={setTodos}
								/>
							</div>
							{create.isError && (
								<p role="alert" className="text-destructive text-sm">
									{create.error.message ||
										"Unable to create workspace. Please try again."}
								</p>
							)}
							<Button
								className="w-full"
								disabled={create.isPending || preparing}
							>
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
					<div className="grid @min-[1000px]/content:grid-cols-3 @min-[640px]/content:grid-cols-2 grid-cols-1 gap-4">
						{spaces.data.items.map((space) => (
							<div
								key={space.id}
								className="flex min-w-0 items-center gap-3 rounded-xl border p-4"
							>
								<WorkspaceLogo
									id={space.id}
									name={space.name}
									hasLogo={space.hasLogo}
								/>
								<div className="min-w-0 flex-1">
									<div className="break-words font-medium">{space.name}</div>
									<div className="break-all text-muted-foreground text-sm">
										{space.slug}
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon"
									className="size-11"
									aria-label={`Settings for ${space.name}`}
									onClick={(event) => {
										settingsTrigger.current = event.currentTarget;
										setSelected(space.id);
									}}
								>
									<Icon icon={Settings} />
								</Button>
							</div>
						))}
					</div>
					{selectedSpace && (
						<WorkspaceSettings
							key={selectedSpace.id}
							space={selectedSpace}
							restoreFocus={() => {
								if (settingsTrigger.current?.isConnected)
									settingsTrigger.current.focus();
								else createTrigger.current?.focus();
							}}
							open
							onOpenChange={(next) => {
								if (!next) setSelected(undefined);
							}}
							todos={selectedSpace.tools.some(
								(tool) => tool.key === "todos" && tool.enabled,
							)}
						/>
					)}
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
