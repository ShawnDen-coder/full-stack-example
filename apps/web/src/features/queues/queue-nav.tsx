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
			className="flex min-h-10 items-center gap-6 text-sm"
		>
			{detail ? (
				<Link
					to="/queues/$queueKey/jobs"
					params={{ queueKey }}
					search={search}
					className="inline-flex min-h-11 items-center font-medium hover:underline"
				>
					← Back to jobs
				</Link>
			) : (
				<>
					<Link
						to="/queues/$queueKey/jobs"
						params={{ queueKey }}
						search={search}
						className={`inline-flex min-h-11 items-center sm:min-h-10 ${schedulers ? "text-muted-foreground hover:text-foreground" : "font-semibold"}`}
					>
						Jobs
					</Link>
					<Link
						to="/queues/$queueKey/schedulers"
						params={{ queueKey }}
						className={`inline-flex min-h-11 items-center sm:min-h-10 ${schedulers ? "font-semibold" : "text-muted-foreground hover:text-foreground"}`}
					>
						Schedulers
					</Link>
				</>
			)}
		</nav>
	);
}
