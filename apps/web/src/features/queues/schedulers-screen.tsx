import "./queue-table.css";
import { Badge } from "@full-stack-example/ui/components/badge";
import { Button } from "@full-stack-example/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@full-stack-example/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { orpc } from "@/utils/orpc";
import { formatInterval, formatTime, shortId } from "./format";
import { QueueQueryState } from "./query-state";
import { QueueNav } from "./queue-nav";

const route = getRouteApi("/_auth/queues/$queueKey/schedulers");

export function QueueSchedulersScreen() {
	const { queueKey } = route.useParams();
	const [page, setPage] = useState(1);
	const schedulers = useQuery({
		...orpc.queues.schedulers.queryOptions({ input: { queueKey, page } }),
		placeholderData: (previous) => previous,
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		meta: { errorHandledLocally: true },
	});
	const lastData = useRef<typeof schedulers.data>(undefined);
	if (schedulers.isSuccess && !schedulers.isPlaceholderData)
		lastData.current = schedulers.data;
	const displayedData = schedulers.data ?? lastData.current;
	const requestKey = JSON.stringify([queueKey, page]);
	const request = useRef({
		key: requestKey,
		baseline: schedulers.dataUpdatedAt,
	});
	if (request.current.key !== requestKey)
		request.current = { key: requestKey, baseline: schedulers.dataUpdatedAt };
	const pageCount = Math.min(
		10000,
		Math.max(1, Math.ceil((displayedData?.total ?? 0) / 50)),
	);
	useEffect(() => {
		if (
			schedulers.isSuccess &&
			!schedulers.isFetching &&
			!schedulers.isPlaceholderData &&
			schedulers.dataUpdatedAt > request.current.baseline &&
			schedulers.data?.page === page &&
			page > pageCount
		)
			setPage(pageCount);
	}, [
		schedulers.isSuccess,
		schedulers.isFetching,
		schedulers.isPlaceholderData,
		schedulers.dataUpdatedAt,
		schedulers.data,
		page,
		pageCount,
	]);
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Queues</h1>
					<p className="text-muted-foreground">{queueKey} · Schedulers</p>
				</div>
				<QueueNav queueKey={queueKey} />
			</div>
			<QueueQueryState
				isPending={schedulers.isPending}
				error={schedulers.error}
				hasData={!!displayedData}
				onRetry={() => void schedulers.refetch()}
			/>
			{displayedData && (
				<div className="min-h-0 flex-1 overflow-auto rounded-md border">
					<Table className="queue-table">
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Schedule</TableHead>
								<TableHead>Timezone</TableHead>
								<TableHead>Next</TableHead>
								<TableHead>Last trigger</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{displayedData.items.length === 0 && (
								<TableRow>
									<TableCell colSpan={5} className="h-24 text-center">
										No schedulers are registered for this queue.
									</TableCell>
								</TableRow>
							)}
							{displayedData.items.map((item) => (
								<TableRow key={item.id}>
									<TableCell>
										<div className="font-medium">{item.name}</div>
										<div
											className="text-muted-foreground text-xs"
											title={item.id}
										>
											{shortId(item.id)}
										</div>
									</TableCell>
									<TableCell data-label="Schedule">
										{item.pattern ??
											(item.every ? formatInterval(item.every) : "—")}
									</TableCell>
									<TableCell data-label="Timezone">{item.tz ?? "—"}</TableCell>
									<TableCell data-label="Next">
										{formatTime(item.next)}
									</TableCell>
									<TableCell data-label="Last trigger">
										{item.lastTrigger.kind === "inferred" ? (
											<span>
												{formatTime(item.lastTrigger.at)}{" "}
												<Badge variant="outline">Inferred</Badge>
											</span>
										) : (
											"No record"
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
			{displayedData && (
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm">
						{displayedData.total.toLocaleString()} schedulers · Page {page} of{" "}
						{pageCount}
					</span>
					<Button
						variant="outline"
						disabled={page <= 1}
						onClick={() => setPage(page - 1)}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						disabled={page >= pageCount}
						onClick={() => setPage(page + 1)}
					>
						Next
					</Button>
				</div>
			)}
		</div>
	);
}
