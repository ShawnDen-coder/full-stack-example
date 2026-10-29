import { canVisit } from "@full-stack-example/access";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@full-stack-example/ui/components/dropdown-menu";
import { Link, useMatch, useMatches } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useAccess } from "@/lib/access";
import { breadcrumbTargets } from "@/lib/breadcrumbs";
import { catalog } from "@/lib/catalog";

export function Breadcrumbs() {
	const matches = useMatches();
	const key = matches.findLast((m) => m.staticData.breadcrumb)?.staticData
		.breadcrumb;
	const job = useMatch({
		from: "/_auth/queues/$queueKey/jobs/$jobId",
		shouldThrow: false,
	});
	const jobs = useMatch({
		from: "/_auth/queues/$queueKey/jobs/",
		shouldThrow: false,
	});
	const schedulers = useMatch({
		from: "/_auth/queues/$queueKey/schedulers",
		shouldThrow: false,
	});
	const access = useAccess();
	const queueKey =
		job?.params.queueKey ??
		jobs?.params.queueKey ??
		schedulers?.params.queueKey;
	const current =
		key === "queue-job"
			? job?.params.jobId
			: key === "queue-jobs"
				? "Jobs"
				: key === "queue-schedulers"
					? "Schedulers"
					: catalog.find((entry) => entry.id === key)?.title;
	if (!current) return null;
	const showHome =
		key === "todos" && access.data && canVisit(access.data, "/apps");
	const showQueues =
		queueKey && access.data && canVisit(access.data, "/queues");
	const ancestors = (
		<>
			{showHome && <Link {...breadcrumbTargets.toolHome}>Tool home</Link>}
			{showQueues && <Link {...breadcrumbTargets.queues}>Queues</Link>}
			{showQueues && key === "queue-job" && (
				<>
					{" "}
					<ChevronRight aria-hidden="true" className="size-4" />{" "}
					<Link {...breadcrumbTargets.jobs(queueKey)}>Jobs</Link>
				</>
			)}
		</>
	);
	const count =
		Number(Boolean(showHome)) +
		Number(Boolean(showQueues)) +
		Number(Boolean(showQueues && key === "queue-job"));
	return (
		<nav
			aria-label="Breadcrumb"
			className="flex min-w-0 flex-1 items-center gap-2 text-sm leading-5"
		>
			{count > 0 && (
				<>
					<span
						className={
							count > 1
								? "hidden items-center gap-2 text-muted-foreground lg:flex [&>a]:hover:text-foreground"
								: "flex shrink-0 items-center gap-2 text-muted-foreground max-[350px]:hidden [&>a]:hover:text-foreground"
						}
					>
						{ancestors}
					</span>
					{count > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger
								className={
									count > 1
										? "flex size-11 shrink-0 items-center text-muted-foreground lg:hidden"
										: "hidden size-11 shrink-0 items-center text-muted-foreground max-[350px]:flex"
								}
								aria-label="Breadcrumb ancestors"
							>
								…
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="max-w-[280px]">
								{showHome && (
									<DropdownMenuItem asChild>
										<Link {...breadcrumbTargets.toolHome}>Tool home</Link>
									</DropdownMenuItem>
								)}
								{showQueues && (
									<DropdownMenuItem asChild>
										<Link {...breadcrumbTargets.queues}>Queues</Link>
									</DropdownMenuItem>
								)}
								{showQueues && key === "queue-job" && (
									<DropdownMenuItem asChild>
										<Link {...breadcrumbTargets.jobs(queueKey)}>Jobs</Link>
									</DropdownMenuItem>
								)}
								<DropdownMenuItem
									disabled
									className="whitespace-normal break-all"
								>
									{current}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
					<ChevronRight
						aria-hidden="true"
						className="size-4 shrink-0 text-muted-foreground max-[350px]:hidden"
					/>
				</>
			)}
			<DropdownMenu>
				<DropdownMenuTrigger
					className="min-w-0 truncate text-start font-medium"
					aria-current="page"
				>
					{current}
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="max-w-[280px] whitespace-normal break-all p-2"
				>
					{current}
				</DropdownMenuContent>
			</DropdownMenu>
		</nav>
	);
}
