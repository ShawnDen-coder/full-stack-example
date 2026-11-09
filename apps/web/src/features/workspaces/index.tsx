import { Button } from "@full-stack-example/ui/components/button";
import { Icon } from "@full-stack-example/ui/components/icon";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { useRef, useState } from "react";
import { client } from "@/utils/orpc";
import { WorkspaceCreateDialog } from "./workspace-create-dialog";
import { WorkspaceLogo } from "./workspace-logo";
import { WorkspaceSettings } from "./workspace-settings";

export function Workspaces() {
	const [offset, setOffset] = useState(0);
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

	const selectedSpace = spaces.data?.items.find(
		(space) => space.id === selected,
	);
	return (
		<div className="mx-auto w-full max-w-240 space-y-4">
			<div className="flex flex-wrap items-center justify-end gap-2">
				<h1 className="sr-only">Workspaces</h1>
				<WorkspaceCreateDialog
					createTrigger={createTrigger}
					refresh={refresh}
				/>
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
					<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
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
