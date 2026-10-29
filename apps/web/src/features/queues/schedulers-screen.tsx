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
import { useEffect, useState } from "react";
import { orpc } from "@/utils/orpc";
import { formatInterval, formatTime, shortId } from "./format";
import { isRpcCode, QueueQueryState } from "./query-state";
import { QueueNav } from "./queue-nav";

const route = getRouteApi("/_auth/queues/$queueKey/schedulers");

export function QueueSchedulersScreen() {
	const { queueKey } = route.useParams();
	const [pagination, setPagination] = useState({ queueKey, page: 1 });
	const page = pagination.queueKey === queueKey ? pagination.page : 1;
	const setPage = (page: number) => setPagination({ queueKey, page });
	const schedulers = useQuery({
		...orpc.queues.schedulers.queryOptions({ input: { queueKey, page } }),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		meta: { errorHandledLocally: true },
	});
	const denied = ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].some((code) =>
		isRpcCode(schedulers.error, code),
	);
	const displayedData = denied ? undefined : schedulers.data;
	const pageCount = Math.min(
		10000,
		Math.max(1, Math.ceil((displayedData?.total ?? 0) / 50)),
	);
	useEffect(() => {
		if (
			schedulers.isSuccess &&
			!schedulers.isFetching &&
			schedulers.data?.page === page &&
			page > pageCount
		)
			setPagination({ queueKey, page: pageCount });
	}, [
		schedulers.isSuccess,
		schedulers.isFetching,
		schedulers.data,
		page,
		pageCount,
		queueKey,
	]);
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="min-w-0">
					<h1 className="font-bold text-2xl tracking-tight">Queues</h1>
					<p className="break-all text-muted-foreground">
						{queueKey} · Schedulers
					</p>
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
						{pageCount} · Updated{" "}
						{formatTime(Date.parse(displayedData.refreshedAt))}
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
