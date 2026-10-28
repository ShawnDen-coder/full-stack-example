import { Link, useLocation } from "@tanstack/react-router";
import type { z } from "zod";
import type { jobsSearchSchema } from "./search";

export function QueueNav({
	queueKey,
	search,
}: {
	queueKey: string;
	search?: z.infer<typeof jobsSearchSchema>;
}) {
	const { pathname } = useLocation();
	const detail = /\/jobs\/[^/]+/.test(pathname);
	const schedulers = /\/schedulers\/?$/.test(pathname);
	return (
		<nav
			aria-label="Queue navigation"
			className="flex flex-wrap items-center gap-3 text-sm"
		>
			<Link
				to="/queues"
				className="text-muted-foreground hover:text-foreground"
			>
				All queues
			</Link>
			<span aria-hidden="true" className="text-muted-foreground">
				/
			</span>
			{(schedulers || detail) && (
				<Link
					to="/queues/$queueKey/jobs"
					params={{ queueKey }}
					search={search}
					className="inline-flex min-h-11 items-center hover:underline sm:min-h-8"
				>
					{schedulers ? "Jobs" : "Back to jobs"}
				</Link>
			)}
			{!schedulers && (
				<Link
					to="/queues/$queueKey/schedulers"
					params={{ queueKey }}
					className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground sm:min-h-8"
				>
					Schedulers
				</Link>
			)}
		</nav>
	);
}
