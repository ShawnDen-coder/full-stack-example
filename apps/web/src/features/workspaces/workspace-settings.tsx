import { Button } from "@full-stack-example/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@full-stack-example/ui/components/dialog";
import { Input } from "@full-stack-example/ui/components/input";
import { Label } from "@full-stack-example/ui/components/label";
import { Switch } from "@full-stack-example/ui/components/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@full-stack-example/ui/components/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { client } from "@/utils/orpc";
import { LogoPreview, prepareLogo } from "./workspace-logo";

type Space = { id: string; name: string; slug: string; hasLogo: boolean };
export function WorkspaceSettings({
	space,
	open,
	onOpenChange,
	todos,
	restoreFocus,
}: {
	space: Space;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	todos?: boolean;
	restoreFocus?: () => void;
}) {
	const queries = useQueryClient();
	const [name, setName] = useState(space.name);
	const [logo, setLogo] = useState<string | null>(null);
	const [fileError, setFileError] = useState("");
	const [preparing, setPreparing] = useState(false);
	const currentLogo = useQuery({
		queryKey: ["workspaces", "logo", space.id],
		queryFn: () => client.access.workspaceLogo({ workspaceId: space.id }),
		enabled: open && space.hasLogo,
	});
	useEffect(() => {
		if (space.hasLogo && currentLogo.data) setLogo(currentLogo.data.logo);
	}, [currentLogo.data, space.hasLogo]);
	const refresh = async () => {
		await queries.invalidateQueries({ queryKey: ["workspaces"] });
		await queries.invalidateQueries({ queryKey: ["access"] });
	};
	const save = useMutation({
		mutationFn: () =>
			client.access.updateWorkspaceBasics({
				workspaceId: space.id,
				name,
				logo,
			}),
		onSuccess: async () => {
			await refresh();
			onOpenChange(false);
		},
	});
	const toggle = useMutation({
		mutationFn: (enabled: boolean) =>
			client.access.setTool({ workspaceId: space.id, tool: "todos", enabled }),
		onSuccess: refresh,
	});
	const busy = save.isPending || toggle.isPending || preparing;
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!busy) onOpenChange(next);
			}}
		>
			<DialogContent
				onCloseAutoFocus={(event) => {
					if (restoreFocus) {
						event.preventDefault();
						restoreFocus();
					}
				}}
			>
				<DialogHeader>
					<DialogTitle>Workspace settings</DialogTitle>
					<DialogDescription className="sr-only">
						Manage {space.name} settings.
					</DialogDescription>
				</DialogHeader>
				<Tabs defaultValue="general">
					<TabsList>
						<TabsTrigger value="general">General</TabsTrigger>
						{todos !== undefined && (
							<TabsTrigger value="tools">Tools</TabsTrigger>
						)}
					</TabsList>
					<TabsContent value="general">
						<form
							className="space-y-4 pt-4"
							onSubmit={(event) => {
								event.preventDefault();
								if (!busy && !(space.hasLogo && !currentLogo.data))
									save.mutate();
							}}
						>
							<div className="space-y-2">
								<Label htmlFor="workspace-logo">Logo</Label>
								<div className="flex flex-wrap items-center gap-2">
									<LogoPreview name={name} logo={logo} />
									<Input
										id="workspace-logo"
										className="max-w-64"
										type="file"
										accept="image/png,image/jpeg,image/webp"
										disabled={busy || (space.hasLogo && !currentLogo.data)}
										onChange={(event) => {
											const file = event.target.files?.[0];
											event.target.value = "";
											if (!file) return;
											setFileError("");
											setPreparing(true);
											void prepareLogo(file)
												.then(setLogo, (error: unknown) =>
													setFileError(
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
										disabled={busy || !logo}
										onClick={() => setLogo(null)}
									>
										Remove
									</Button>
								</div>
								<p className="text-muted-foreground text-sm">
									PNG, JPEG or WebP, up to 5 MB. Images are resized for storage.
								</p>
								{fileError && (
									<p role="alert" className="text-destructive text-sm">
										{fileError}
									</p>
								)}
							</div>
							{currentLogo.isError && (
								<p role="alert">
									Unable to load logo.{" "}
									<Button
										type="button"
										variant="link"
										onClick={() => void currentLogo.refetch()}
									>
										Retry
									</Button>
								</p>
							)}
							<div className="space-y-2">
								<Label htmlFor="settings-name">Name</Label>
								<Input
									id="settings-name"
									disabled={busy}
									required
									maxLength={80}
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="settings-slug">Slug</Label>
								<Input id="settings-slug" value={space.slug} readOnly />
							</div>
							{save.isError && (
								<p role="alert" className="text-destructive text-sm">
									{save.error.message ||
										"Unable to save settings. Please try again."}
								</p>
							)}
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									disabled={busy}
									onClick={() => onOpenChange(false)}
								>
									Cancel
								</Button>
								<Button disabled={busy || (space.hasLogo && !currentLogo.data)}>
									{save.isPending ? "Saving…" : "Save changes"}
								</Button>
							</div>
						</form>
					</TabsContent>
					{todos !== undefined && (
						<TabsContent value="tools" className="space-y-4 pt-4">
							<div className="flex items-center justify-between gap-4">
								<div>
									<Label htmlFor="settings-todos">Enable Todos</Label>
									<p className="text-muted-foreground text-sm">
										Allow members with access to use Todos.
									</p>
								</div>
								<Switch
									id="settings-todos"
									checked={todos}
									disabled={busy}
									onCheckedChange={(enabled) => toggle.mutate(enabled)}
								/>
							</div>
							<p className="text-muted-foreground text-sm">
								Changes save automatically.
							</p>
							{toggle.isError && (
								<p role="alert" className="text-destructive text-sm">
									Unable to update Todos. Please try again.
								</p>
							)}
							<div className="flex justify-end">
								<Button
									variant="outline"
									disabled={busy}
									onClick={() => onOpenChange(false)}
								>
									Done
								</Button>
							</div>
						</TabsContent>
					)}
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
