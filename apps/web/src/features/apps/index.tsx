import { Button } from "@full-stack-example/ui/components/button";
import { Input } from "@full-stack-example/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@full-stack-example/ui/components/select";
import { Separator } from "@full-stack-example/ui/components/separator";
import { getRouteApi } from "@tanstack/react-router";
import { ArrowDownAZ, ArrowUpAZ, SlidersHorizontal } from "lucide-react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";
import { apps } from "./data/apps";

const route = getRouteApi("/_auth/apps_/integrations-demo");

type AppType = "all" | "connected" | "notConnected";

const appText = new Map<AppType, string>([
	["all", "All Apps"],
	["connected", "Connected"],
	["notConnected", "Not Connected"],
]);

export function Apps() {
	const { filter = "", type = "all", sort = "asc" } = route.useSearch();
	const navigate = route.useNavigate();

	const appType = type;
	const searchTerm = filter;

	const filteredApps = [...apps]
		.sort((a, b) =>
			sort === "asc"
				? a.name.localeCompare(b.name)
				: b.name.localeCompare(a.name),
		)
		.filter((app) =>
			appType === "connected"
				? app.connected
				: appType === "notConnected"
					? !app.connected
					: true,
		)
		.filter((app) => app.name.toLowerCase().includes(searchTerm.toLowerCase()));

	const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
		navigate({
			search: (prev) => ({
				...prev,
				filter: e.target.value || undefined,
			}),
		});
	};

	const handleTypeChange = (value: AppType) => {
		navigate({
			search: (prev) => ({
				...prev,
				type: value === "all" ? undefined : value,
			}),
		});
	};

	const handleSortChange = (sort: "asc" | "desc") => {
		navigate({ search: (prev) => ({ ...prev, sort }) });
	};

	return (
		<>
			{/* ===== Top Heading ===== */}

			{/* ===== Content ===== */}
			<div className="flex flex-1 flex-col">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">
						Integration examples
					</h1>
					<p className="text-muted-foreground">
						Demo only: these connections are examples and are not connected to
						your account.
					</p>
				</div>
				<div className="my-4 flex items-end justify-between sm:my-0 sm:items-center">
					<div className="flex flex-col gap-4 sm:my-4 sm:flex-row">
						<Input
							placeholder="Filter apps..."
							className="h-9 w-40 lg:w-62.5"
							value={searchTerm}
							onChange={handleSearch}
						/>
						<Select value={appType} onValueChange={handleTypeChange}>
							<SelectTrigger aria-label="Connection status" className="w-36">
								<SelectValue>{appText.get(appType)}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Apps</SelectItem>
								<SelectItem value="connected">Connected</SelectItem>
								<SelectItem value="notConnected">Not Connected</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<Select value={sort} onValueChange={handleSortChange}>
						<SelectTrigger aria-label="Sort apps" className="w-16">
							<SelectValue>
								<SlidersHorizontal size={18} />
							</SelectValue>
						</SelectTrigger>
						<SelectContent align="end">
							<SelectItem value="asc">
								<div className="flex items-center gap-4">
									<ArrowUpAZ size={16} />
									<span>Ascending</span>
								</div>
							</SelectItem>
							<SelectItem value="desc">
								<div className="flex items-center gap-4">
									<ArrowDownAZ size={16} />
									<span>Descending</span>
								</div>
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<Separator className="shadow-sm" />
				<ul className="faded-bottom no-scrollbar grid gap-4 overflow-auto pt-4 pb-16 md:grid-cols-2 lg:grid-cols-3">
					{filteredApps.map((app) => (
						<li
							key={app.name}
							className="rounded-lg border p-4 hover:shadow-md"
						>
							<div className="mb-8 flex items-center justify-between">
								<div
									className={
										"flex size-10 items-center justify-center rounded-lg bg-muted p-2"
									}
								>
									{app.logo}
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										toast.info("Demo integration — no account is connected.")
									}
									className={`${app.connected ? "border border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900" : ""}`}
								>
									{app.connected ? "Connected" : "Connect"}
								</Button>
							</div>
							<div>
								<h2 className="mb-1 font-semibold">{app.name}</h2>
								<p className="line-clamp-2 text-gray-500">{app.desc}</p>
							</div>
						</li>
					))}
				</ul>
			</div>
		</>
	);
}
