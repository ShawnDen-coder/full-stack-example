import { Badge } from "@full-stack-example/ui/components/badge";
import {
	Empty,
	EmptyDescription,
} from "@full-stack-example/ui/components/empty";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { orpc } from "@/utils/orpc";
import { isRpcCode, QueueQueryState } from "./query-state";
import { jobStatuses, jobStatusLabels } from "./statuses";

export function QueuesOverview() {
	const queues = useQuery({
		...orpc.queues.list.queryOptions(),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		meta: { errorHandledLocally: true },
	});
	const hidden = ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].some((code) =>
		isRpcCode(queues.error, code),
	);
	const data = hidden ? undefined : queues.data;
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6">
			<h1 className="font-bold text-2xl tracking-tight">Queues</h1>
			<QueueQueryState
				isPending={queues.isPending}
				error={queues.error}
				hasData={!!data}
				onRetry={() => void queues.refetch()}
			/>

			{data && (
				<ul className="min-h-0 flex-1 divide-y overflow-auto">
					{data.map((queue) => (
						<li
							key={queue.key}
							className="relative flex flex-wrap items-center gap-x-6 gap-y-2 py-4 hover:bg-muted/30"
						>
							<div className="flex min-w-0 max-w-full items-center gap-3">
								<Link
									to="/queues/$queueKey/jobs"
									params={{ queueKey: queue.key }}
									className="min-w-0 break-all font-medium after:absolute after:inset-0"
									title={queue.key}
								>
									{queue.name}
								</Link>
								<Badge variant="secondary" className="shrink-0">
									{queue.paused ? "Paused" : "Running"}
								</Badge>
							</div>
							<div className="flex flex-wrap gap-x-4 gap-y-1">
								{jobStatuses.map((status) => (
									<Link
										key={status}
										to="/queues/$queueKey/jobs"
										params={{ queueKey: queue.key }}
										search={{ status }}
										className="relative z-10 inline-flex min-h-11 items-center gap-2 text-sm hover:underline sm:min-h-8"
									>
										<span className="text-muted-foreground">
											{jobStatusLabels[status]}
										</span>
										<span className="tabular-nums">
											{queue.counts[status].toLocaleString()}
										</span>
									</Link>
								))}
							</div>
							<Link
								to="/queues/$queueKey/schedulers"
								params={{ queueKey: queue.key }}
								className="relative z-10 inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline sm:ml-auto sm:min-h-8"
							>
								Schedulers
							</Link>
						</li>
					))}
					{data.length === 0 && (
						<li className="py-8 text-muted-foreground text-sm">
							<Empty>
								<EmptyDescription>No queues are registered.</EmptyDescription>
							</Empty>
						</li>
					)}
				</ul>
			)}
		</div>
	);
}
