import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@full-stack-example/ui/components/collapsible";
import {
	Empty,
	EmptyDescription,
} from "@full-stack-example/ui/components/empty";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useAccess } from "@/lib/access";
import {
	type CatalogEntry,
	catalogGroups,
	visibleCatalog,
} from "@/lib/catalog";

function Section({
	group,
	entries,
	compact = false,
	adminCanManage = false,
}: {
	group: "tools" | "admin" | "account";
	entries: readonly CatalogEntry[];
	compact?: boolean;
	adminCanManage?: boolean;
}) {
	const label = catalogGroups.find((item) => item.id === group)?.label;
	if (!entries.length && group !== "tools") return null;
	return (
		<section
			className="flex min-w-0 flex-col gap-3"
			aria-labelledby={`catalog-${group}`}
		>
			<h2 className="font-semibold text-sm" id={`catalog-${group}`}>
				{label}
			</h2>
			{entries.length ? (
				<div className="divide-y rounded-md border">
					{entries.map((entry) => (
						<Link
							key={entry.id}
							to={entry.url}
							className={
								compact
									? "flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-foreground focus-visible:-outline-offset-2 motion-safe:transition-colors motion-safe:duration-150"
									: "flex min-h-20 items-center gap-4 px-4 py-4 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-foreground focus-visible:-outline-offset-2 motion-safe:transition-colors motion-safe:duration-150"
							}
						>
							<entry.icon
								className="size-5 shrink-0 text-muted-foreground"
								aria-hidden="true"
							/>
							<span className="min-w-0 flex-1">
								<span className="block font-semibold text-base">
									{entry.title}
								</span>
								{!compact && (
									<span className="block text-muted-foreground text-sm">
										{entry.description}
									</span>
								)}
							</span>
							<ArrowRight
								className="size-4 shrink-0 text-muted-foreground"
								aria-hidden="true"
							/>
						</Link>
					))}
				</div>
			) : (
				<Empty>
					<EmptyDescription>
						No tools are enabled for your account.{" "}
						{adminCanManage ? (
							<Link to="/admin/users" className="underline">
								Manage page access.
							</Link>
						) : (
							"Ask an administrator for access."
						)}
					</EmptyDescription>
				</Empty>
			)}
		</section>
	);
}
export function ToolCenter() {
	const access = useAccess();
	const entries = access.data ? visibleCatalog(access.data) : [];
	const tools = entries.filter((entry) => entry.group === "tools");
	const admin = entries.filter((entry) => entry.group === "admin");
	const account = entries.filter((entry) => entry.group === "account");
	const demos = entries.filter((entry) => entry.group === "demo");
	return (
		<div className="@container mx-auto flex w-full max-w-5xl flex-col gap-8 pb-12">
			<header className="flex flex-col gap-2">
				<h1 className="font-semibold text-2xl tracking-tight">Tool center</h1>
				<p className="text-muted-foreground text-sm">
					Choose a tool or manage your account.
				</p>
			</header>
			<div className="grid min-w-0 @[960px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] @[960px]:gap-6 gap-8">
				<Section
					group="tools"
					entries={tools}
					adminCanManage={admin.length > 0}
				/>
				<div className="flex min-w-0 flex-col gap-8">
					<Section group="admin" entries={admin} compact />
					<Section group="account" entries={account} compact />
				</div>
			</div>
			{demos.length > 0 && (
				<Collapsible className="flex flex-col gap-3">
					<CollapsibleTrigger className="flex min-h-11 items-center justify-between gap-3 text-left font-semibold text-sm focus-visible:outline-2 focus-visible:outline-foreground focus-visible:-outline-offset-2">
						{catalogGroups.find((group) => group.id === "demo")?.label}
						<ChevronDown className="size-4" aria-hidden="true" />
					</CollapsibleTrigger>
					<CollapsibleContent>
						<div className="divide-y rounded-md border">
							{demos.map((entry) => (
								<Link
									key={entry.id}
									to={entry.url}
									className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-foreground focus-visible:-outline-offset-2 motion-safe:transition-colors motion-safe:duration-150"
								>
									<entry.icon
										className="size-4 text-muted-foreground"
										aria-hidden="true"
									/>
									<span className="flex-1">{entry.title}</span>
									<ArrowRight
										className="size-4 text-muted-foreground"
										aria-hidden="true"
									/>
								</Link>
							))}
						</div>
					</CollapsibleContent>
				</Collapsible>
			)}
		</div>
	);
}
