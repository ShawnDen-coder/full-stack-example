import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@full-stack-example/ui/components/card";
import {
	Empty,
	EmptyDescription,
} from "@full-stack-example/ui/components/empty";
import { Icon } from "@full-stack-example/ui/components/icon";
import { Link, useNavigate } from "@tanstack/react-router";
import { Hammer } from "lucide-react";
import { useRef } from "react";
import { useAccess } from "@/lib/access";
import { visibleCatalog } from "@/lib/catalog";
import { useWorkspaceId } from "@/lib/workspace";

export function ToolCenter() {
	return (
		<>
			<h1 className="sr-only">Tool home</h1>
			<ToolCenterContent />
		</>
	);
}
function ToolCenterContent() {
	const pointerType = useRef("mouse");
	const access = useAccess();
	const workspaceId = useWorkspaceId();
	const navigate = useNavigate();
	const tools = access.data
		? visibleCatalog(access.data).filter((entry) => entry.kind === "real")
		: [];
	if (!access.data?.organizationId)
		return (
			<Empty>
				<EmptyDescription>
					{workspaceId
						? "You no longer have access to this workspace. Choose another workspace."
						: "No workspace yet. Ask an administrator to add you."}
				</EmptyDescription>
				{access.data?.platformRole === "superadmin" && (
					<Link
						to="/workspaces"
						className="text-sm underline underline-offset-4"
					>
						Manage workspaces
					</Link>
				)}
			</Empty>
		);
	if (!tools.length)
		return (
			<Empty>
				<EmptyDescription>
					{access.data.role === "admin"
						? "No tools available. Ask a platform administrator to check enabled tools."
						: "No tools available. Contact your workspace administrator."}
				</EmptyDescription>
			</Empty>
		);
	return (
		<section aria-label="Tools" className="@container/tools">
			<div className="grid @min-[560px]/tools:grid-cols-2 @min-[900px]/tools:grid-cols-3 grid-cols-1 gap-6">
				{tools.map((tool) => (
					<Card
						key={tool.id}
						className="gap-0 overflow-hidden py-0 hover:border-foreground/30 motion-safe:transition-colors"
					>
						<button
							type="button"
							aria-label={tool.title}
							title="Double-click to open"
							className="w-full cursor-pointer text-left outline-none focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid focus-visible:-outline-offset-2"
							onPointerDown={(event) => {
								pointerType.current = event.pointerType;
							}}
							onTouchStart={() => {
								pointerType.current = "touch";
							}}
							onDoubleClick={() => void navigate({ to: tool.url })}
							onClick={(event) => {
								// Keyboard activation and touch/pen clicks; mouse activation requires a double click.
								if (event.detail === 0 || pointerType.current !== "mouse")
									void navigate({ to: tool.url });
								pointerType.current = "mouse";
							}}
						>
							<div className="flex aspect-video items-center justify-center border-b bg-muted/50">
								<Icon icon={Hammer} className="size-12 text-muted-foreground" />
							</div>
							<CardHeader className="gap-2 p-6">
								<CardTitle>{tool.title}</CardTitle>
								<CardDescription>{tool.description}</CardDescription>
							</CardHeader>
						</button>
					</Card>
				))}
			</div>
		</section>
	);
}
