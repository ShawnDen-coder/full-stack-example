import { Badge } from "@full-stack-example/ui/components/badge";
import { Button } from "@full-stack-example/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { orpc } from "@/utils/orpc";
import { formatTime } from "./format";
import { isRpcCode, QueueQueryState } from "./query-state";
import { QueueNav } from "./queue-nav";

const route = getRouteApi("/_auth/queues/$queueKey/jobs/$jobId");

export function QueueJobDetail() {
	const { queueKey, jobId } = route.useParams();
	return <QueueJobDetailContent key={JSON.stringify([queueKey, jobId])} />;
}

function QueueJobDetailContent() {
	const { queueKey, jobId } = route.useParams();
	const search = route.useSearch();
	const [page, setPage] = useState(1);
	const job = useQuery({
		...orpc.queues.job.queryOptions({ input: { queueKey, jobId } }),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		meta: { errorHandledLocally: true },
	});
	const logs = useQuery({
		...orpc.queues.logs.queryOptions({
			input: { queueKey, jobId, page, pageSize: 50 },
		}),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		meta: { errorHandledLocally: true },
	});
	const blocks = (error: unknown) =>
		["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].some((code) =>
			isRpcCode(error, code),
		);
	const resource = JSON.stringify([queueKey, jobId]);
	const blocked = useRef<{
		resource: string;
		job: { error: unknown; updatedAt: number } | null;
		logs: { error: unknown; updatedAt: number } | null;
	}>({ resource, job: null, logs: null });
	if (blocked.current.resource !== resource)
		blocked.current = { resource, job: null, logs: null };
	for (const [source, query] of [
		["job", job],
		["logs", logs],
	] as const) {
		if (blocks(query.error))
			blocked.current[source] = {
				error: query.error,
				updatedAt: query.dataUpdatedAt,
			};
		else if (
			blocked.current[source] &&
			query.isSuccess &&
			query.dataUpdatedAt !== blocked.current[source]?.updatedAt
		)
			blocked.current[source] = null;
	}
	const blockingJob = blocked.current.job;
	const blockingLogs = blocked.current.logs;
	const hidden = blockingJob || blockingLogs;
	const detail = hidden ? undefined : job.data;
	const logData = hidden ? undefined : logs.data;
	const logPageCount = Math.min(
		10000,
		Math.max(1, Math.ceil((logData?.total ?? 0) / 50)),
	);
	useEffect(() => {
		if (
			!hidden &&
			logs.isSuccess &&
			!logs.isFetching &&
			logData &&
			logData.page === page &&
			page > logPageCount
		)
			setPage(logPageCount);
	}, [hidden, logs.isSuccess, logs.isFetching, logData, page, logPageCount]);
	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b pb-2">
				<h1 className="sr-only">{jobId}</h1>
				<QueueNav queueKey={queueKey} search={search} />
				<Button
					variant="outline"
					size="sm"
					className="min-h-11 sm:min-h-9"
					onClick={() => void navigator.clipboard.writeText(jobId)}
				>
					Copy Job ID
				</Button>
				<p className="text-muted-foreground text-sm">
					Read only
					{detail &&
						` · ${detail.name} · Updated ${formatTime(Date.parse(detail.refreshedAt))}`}
				</p>
			</div>
			<QueueQueryState
				isPending={hidden ? false : job.isPending}
				error={blockingJob?.error ?? blockingLogs?.error ?? job.error}
				hasData={!!detail}
				onRetry={() =>
					void (blockingLogs && !blockingJob ? logs.refetch() : job.refetch())
				}
			/>
			{detail && (
				<>
					{(detail.failedReason || detail.stacktrace) && (
						<div className="rounded-md border p-4">
							<h2 className="mb-2 font-medium">Failure</h2>
							{detail.failedReason ? (
								<pre className="whitespace-pre-wrap break-words font-mono text-xs">
									{detail.failedReason}
								</pre>
							) : (
								<p className="text-muted-foreground text-sm">
									No failure reason.
								</p>
							)}
							{detail.stacktrace && (
								<div className="mt-3 rounded-md border p-3">
									<pre className="whitespace-pre-wrap break-all text-xs">
										{detail.stacktrace}
									</pre>
								</div>
							)}
						</div>
					)}
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						<div>
							<dt className="text-muted-foreground">State</dt>
							<dd>
								<Badge
									variant={
										detail.state === "failed" ? "destructive" : "outline"
									}
								>
									{detail.state}
								</Badge>
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Attempts</dt>
							<dd>
								{detail.attemptsMade} of {detail.attemptsConfigured ?? "—"}{" "}
								configured
							</dd>
						</div>
					</dl>
					<section>
						<h2 className="mb-3 font-medium">Timeline</h2>
						<dl className="grid gap-3 text-sm sm:grid-cols-3">
							<div>
								<dt className="text-muted-foreground">Created</dt>
								<dd>{formatTime(detail.timestamp)}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Processed</dt>
								<dd>{formatTime(detail.processedOn)}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Finished</dt>
								<dd>{formatTime(detail.finishedOn)}</dd>
							</div>
						</dl>
					</section>
					{(
						[
							["Data summary", detail.summary],
							["Result summary", detail.result],
						] as const
					).map(([title, fields]) => (
						<section key={title}>
							<h2 className="mb-3 font-medium">{title}</h2>
							{Object.keys(fields).length ? (
								<dl className="grid gap-3 text-sm sm:grid-cols-2">
									{Object.entries(fields).map(([key, value]) => (
										<div key={key}>
											<dt className="text-muted-foreground">{key}</dt>
											<dd className="break-all">{value}</dd>
										</div>
									))}
								</dl>
							) : (
								<p className="text-muted-foreground text-sm">
									No {title.toLowerCase()} is available.
								</p>
							)}
						</section>
					))}

					<div>
						<h2 className="mb-2 font-medium">Logs</h2>
						<p className="mb-2 text-muted-foreground text-xs">
							Redacted and truncated where necessary
							{logData && ` · Updated ${formatTime(logs.dataUpdatedAt)}`}
						</p>
						<QueueQueryState
							isPending={logs.isPending}
							error={logs.error}
							hasData={!!logData}
							onRetry={() => void logs.refetch()}
							retryLabel="Retry loading"
						/>
						{logData?.total === 0 && (
							<p className="text-muted-foreground text-sm">
								No additional logs are available for this job.
							</p>
						)}
						{logData && logData.lines.length > 0 && (
							<div className="rounded-md border p-3">
								<pre className="whitespace-pre-wrap break-words font-mono text-xs">
									{logData.lines.join("\n")}
								</pre>
							</div>
						)}
						{logData?.clipped && (
							<p className="mt-2 text-muted-foreground text-xs">
								Some lines were shortened.
							</p>
						)}
						{logData && logData.total > 50 && (
							<div className="mt-3 flex flex-wrap items-center gap-2">
								<Button
									variant="outline"
									disabled={page <= 1}
									onClick={() => setPage((current) => current - 1)}
								>
									Previous logs
								</Button>
								<span className="text-sm">
									Page {page} of {logPageCount}
								</span>
								<Button
									variant="outline"
									disabled={page >= logPageCount}
									onClick={() => setPage((current) => current + 1)}
								>
									Next logs
								</Button>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
}
