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
import { useMutation } from "@tanstack/react-query";
import { type RefObject, useState } from "react";
import { toast } from "sonner";
import { client } from "@/utils/orpc";
import { LogoField } from "./logo-field";
import { prepareLogo } from "./workspace-logo";

export function WorkspaceCreateDialog({
	createTrigger,
	refresh,
}: {
	createTrigger: RefObject<HTMLButtonElement | null>;
	refresh: () => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [email, setEmail] = useState("");
	const [todos, setTodos] = useState(true);
	const [logo, setLogo] = useState<string | null>(null);
	const [logoError, setLogoError] = useState("");
	const [preparing, setPreparing] = useState(false);
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
	return (
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
						<LogoField
							id="new-logo"
							label="Logo (optional)"
							compact
							disabled={create.isPending || preparing}
							removeDisabled={!logo || create.isPending || preparing}
							name={name}
							logo={logo}
							onRemove={() => setLogo(null)}
							onFile={(file) => {
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
					<Button className="w-full" disabled={create.isPending || preparing}>
						{create.isPending ? "Creating…" : "Create workspace"}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
