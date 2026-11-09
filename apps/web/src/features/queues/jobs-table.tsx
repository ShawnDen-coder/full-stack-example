import type { AppRouterClient } from "@full-stack-example/api/routers/index";
import {
	Empty,
	EmptyDescription,
} from "@full-stack-example/ui/components/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@full-stack-example/ui/components/table";
import { Link } from "@tanstack/react-router";
import type { z } from "zod";
import {
	failureSummary,
	formatCompactTime,
	formatTime,
	shortId,
} from "./format";
import type { jobsSearchSchema } from "./search";
import type { JobStatus } from "./statuses";

type Jobs = NonNullable<
	Awaited<ReturnType<AppRouterClient["queues"]["jobs"]>>
>["items"];
type Search = z.output<typeof jobsSearchSchema>;

export function QueueJobsTable({
	items,
	showFailure,
	mode,
	status,
	queueKey,
	search,
	onJobNavigate,
}: {
	items: Jobs;
	showFailure: boolean;
	mode: "browse" | "id" | "name";
	status: JobStatus;
	queueKey: string;
	search: Search;
	onJobNavigate: () => void;
}) {
	return (
		<div className="shrink-0 overflow-x-auto rounded-md border">
			<Table
				className={`queue-table queue-jobs-table ${showFailure ? "has-failure" : ""}`}
			>
				<TableHeader>
					<TableRow>
						<TableHead>Job</TableHead>
						{showFailure && <TableHead>Failure</TableHead>}
						<TableHead className="text-right">Attempts</TableHead>
						<TableHead className="text-right">Created</TableHead>
						<TableHead className="text-right">
							{mode === "browse"
								? status === "active"
									? "Processed"
									: "Finished"
								: "Latest time"}
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{items.length ? (
						items.map((job) => (
							<TableRow key={job.id}>
								<TableCell>
									<Link
										to="/queues/$queueKey/jobs/$jobId"
										params={{ queueKey, jobId: job.id }}
										onClick={onJobNavigate}
										search={search}
										title={job.id}
										className="font-medium hover:underline"
									>
										{shortId(job.id)}
									</Link>
									<div
										className="text-muted-foreground text-xs"
										title={job.summary.userId}
									>
										{job.name} · User ID{" "}
										{job.summary.userId ? shortId(job.summary.userId) : "—"} ·{" "}
										{job.state}
									</div>
								</TableCell>
								{showFailure && (
									<TableCell
										className={
											job.failedReason ? undefined : "queue-empty-failure"
										}
									>
										<span className="queue-field-label">Failure</span>
										<span
											className="queue-failure-summary"
											title={failureSummary(job.failedReason)}
										>
											{failureSummary(job.failedReason)}
										</span>
									</TableCell>
								)}
								<TableCell className="text-right tabular-nums">
									<span className="queue-field-label">Attempts</span>
									<span>
										{job.attemptsMade} / {job.attemptsConfigured ?? "—"}
									</span>
								</TableCell>
								<TableCell className="queue-created-time text-right">
									<span className="queue-field-label">Created</span>
									<span>{formatTime(job.timestamp)}</span>
								</TableCell>
								<TableCell className="queue-latest-time text-right">
									<div className="queue-desktop-time">
										<span className="queue-field-label">
											{job.state === "active" ? "Processed" : "Finished"}
										</span>
										<span>
											{formatTime(
												job.state === "active"
													? job.processedOn
													: job.finishedOn,
											)}
										</span>
									</div>
									<div className="queue-mobile-time">
										<span className="queue-field-label">
											{job.state === "failed" || job.state === "completed"
												? "Finished"
												: job.state === "active"
													? "Processed"
													: "Created"}
										</span>{" "}
										<span>
											{formatCompactTime(
												job.state === "failed" || job.state === "completed"
													? job.finishedOn
													: job.state === "active"
														? job.processedOn
														: job.timestamp,
											)}
										</span>
									</div>
								</TableCell>
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell
								colSpan={showFailure ? 5 : 4}
								className="h-24 text-center"
							>
								<Empty className="border-0">
									<EmptyDescription>
										{mode === "browse"
											? "No jobs in this state."
											: "No matches in the searched range."}
									</EmptyDescription>
								</Empty>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
