import { Badge } from "@full-stack-example/ui/components/badge";
import { Button } from "@full-stack-example/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import { formatTime } from "./format";
import { QueueQueryState } from "./query-state";
import { QueueNav } from "./queue-nav";

const route = getRouteApi("/_auth/queues/$queueKey/jobs/$jobId");

export function QueueJobDetail() {
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
	const detail = job.data;
	const logPageCount = Math.min(
		10000,
		Math.max(1, Math.ceil((logs.data?.total ?? 0) / 50)),
	);
	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Queues</h1>
					<p className="break-all text-muted-foreground">
						{queueKey} · {jobId}
						<Button
							variant="outline"
							size="sm"
							className="ml-2"
							onClick={() => void navigator.clipboard.writeText(jobId)}
						>
							Copy Job ID
						</Button>
					</p>
				</div>
				<QueueNav queueKey={queueKey} search={search} />
			</div>
			<QueueQueryState
				isPending={job.isPending}
				error={job.error}
				hasData={!!job.data}
				onRetry={() => void job.refetch()}
			/>
			{detail && (
				<>
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
						<h2 className="mb-3 font-medium">Timing</h2>
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
							["Payload", detail.summary],
							["Result", detail.result],
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
						<h2 className="mb-2 font-medium">Failure</h2>
						{detail.failedReason ? (
							<pre className="whitespace-pre-wrap break-all font-mono text-xs">
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
					<div>
						<h2 className="mb-2 font-medium">Additional logs</h2>
						<QueueQueryState
							isPending={logs.isPending}
							error={logs.error}
							hasData={!!logs.data}
							onRetry={() => void logs.refetch()}
						/>
						{logs.data?.total === 0 && (
							<p className="text-muted-foreground text-sm">
								No additional logs are available for this job.
							</p>
						)}
						{logs.data && logs.data.lines.length > 0 && (
							<div className="rounded-md border p-3">
								<pre className="whitespace-pre-wrap break-all font-mono text-xs">
									{logs.data.lines.join("\n")}
								</pre>
							</div>
						)}
						{logs.data?.clipped && (
							<p className="mt-2 text-muted-foreground text-xs">
								Some lines were shortened.
							</p>
						)}
						{logs.data && logs.data.total > 50 && (
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
