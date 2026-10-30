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
import { breadcrumbAncestors, breadcrumbTargets } from "@/lib/breadcrumbs";
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
	const queuePage =
		key === "queue-job" || key === "queue-jobs" || key === "queue-schedulers";
	const leaf =
		key === "queue-job"
			? job?.params.jobId
			: key === "queue-jobs"
				? "Jobs"
				: key === "queue-schedulers"
					? "Schedulers"
					: catalog.find((entry) => entry.id === key)?.title;
	const current =
		queuePage && queueKey && leaf ? `${queueKey} / ${leaf}` : leaf;
	if (!current) return null;
	const chain = breadcrumbAncestors(key, queueKey, {
		toolHome: Boolean(access.data && canVisit(access.data, "/apps")),
		queues: Boolean(access.data && canVisit(access.data, "/queues")),
	});
	const showHome = chain.includes("tool-home");
	const showQueues = Boolean(queueKey && chain.includes("queues"));

	const ancestors = (
		<>
			{showHome && (
				<Link {...breadcrumbTargets.toolHome} activeOptions={{ exact: true }}>
					Tool home
				</Link>
			)}
			{showQueues && (
				<Link {...breadcrumbTargets.queues} activeOptions={{ exact: true }}>
					Queues
				</Link>
			)}
			{showQueues && queueKey && chain.includes("jobs") && (
				<>
					{" "}
					<ChevronRight aria-hidden="true" className="size-4" />{" "}
					<Link
						{...breadcrumbTargets.jobs(queueKey)}
						activeOptions={{ exact: true }}
					>
						Jobs
					</Link>
				</>
			)}
		</>
	);
	// The queue is rendered beside the current page, not as a separate link.
	const count = chain.filter((item) => item !== "queue").length;
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
								: showQueues
									? "hidden shrink-0 items-center gap-2 text-muted-foreground sm:flex [&>a]:hover:text-foreground"
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
										? queuePage
											? "hidden"
											: "flex size-11 shrink-0 items-center text-muted-foreground lg:hidden"
										: showQueues
											? "hidden"
											: "hidden size-11 shrink-0 items-center text-muted-foreground max-[350px]:flex"
								}
								aria-label="Breadcrumb ancestors"
							>
								…
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="max-w-[280px]">
								{showHome && (
									<DropdownMenuItem asChild>
										<Link
											{...breadcrumbTargets.toolHome}
											activeOptions={{ exact: true }}
										>
											Tool home
										</Link>
									</DropdownMenuItem>
								)}
								{showQueues && (
									<DropdownMenuItem asChild>
										<Link
											{...breadcrumbTargets.queues}
											activeOptions={{ exact: true }}
										>
											Queues
										</Link>
									</DropdownMenuItem>
								)}
								{showQueues && queueKey && chain.includes("jobs") && (
									<DropdownMenuItem asChild>
										<Link
											{...breadcrumbTargets.jobs(queueKey)}
											activeOptions={{ exact: true }}
										>
											Jobs
										</Link>
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
						className={
							showQueues
								? count === 1
									? "hidden size-4 shrink-0 text-muted-foreground sm:block"
									: "hidden size-4 shrink-0 text-muted-foreground lg:block"
								: "size-4 shrink-0 text-muted-foreground max-[350px]:hidden"
						}
					/>
				</>
			)}
			<DropdownMenu>
				<DropdownMenuTrigger
					className={
						queuePage
							? "flex min-w-0 items-center gap-0.5 text-start font-medium text-xs sm:text-sm"
							: "min-w-0 truncate text-start font-medium"
					}
					aria-current="page"
				>
					{queuePage ? (
						<>
							{queueKey && (
								<>
									<span className="min-w-0 truncate" title={queueKey}>
										{queueKey}
									</span>
									<span aria-hidden="true">/</span>
								</>
							)}
							<span
								className={
									key === "queue-job" ? "min-w-0 truncate" : "shrink-0"
								}
								title={leaf}
							>
								{leaf}
							</span>
						</>
					) : (
						leaf
					)}
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="max-w-[280px] whitespace-normal break-all p-2"
				>
					{showQueues && (
						<DropdownMenuItem
							asChild
							className={count === 1 ? "sm:hidden" : "lg:hidden"}
						>
							<Link
								{...breadcrumbTargets.queues}
								activeOptions={{ exact: true }}
							>
								Queues
							</Link>
						</DropdownMenuItem>
					)}
					{showQueues && queueKey && chain.includes("jobs") && (
						<DropdownMenuItem asChild className="lg:hidden">
							<Link
								{...breadcrumbTargets.jobs(queueKey)}
								activeOptions={{ exact: true }}
							>
								Jobs
							</Link>
						</DropdownMenuItem>
					)}
					<div>{current}</div>
				</DropdownMenuContent>
			</DropdownMenu>
		</nav>
	);
}
