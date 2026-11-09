import "./queue-table.css";
import { Button } from "@full-stack-example/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@full-stack-example/ui/components/field";
import { Input } from "@full-stack-example/ui/components/input";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@full-stack-example/ui/components/toggle-group";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { orpc, scopeTicket } from "@/utils/orpc";
import { formatTime } from "./format";
import { QueueJobsTable } from "./jobs-table";
import { isRpcCode, QueueQueryState } from "./query-state";
import { QueueNav } from "./queue-nav";
import { type JobStatus, jobStatuses, jobStatusLabels } from "./statuses";
import { useQueueJobs } from "./use-queue-jobs";

const browseScroll = new Map<string, number>();

const route = getRouteApi("/_auth/queues/$queueKey/jobs/");
export function QueueJobsScreen() {
	const { queueKey } = route.useParams();
	const search = route.useSearch();
	const navigate = route.useNavigate();
	const { session } = route.useRouteContext();
	const owner = useRef({
		userId: session.data?.user.id ?? null,
		generation: scopeTicket(),
	}).current;
	const mode = search.mode ?? "browse";
	const queues = useQuery({
		...orpc.queues.list.queryOptions(),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		meta: { errorHandledLocally: true },
	});
	const listDenied = ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].some((code) =>
		isRpcCode(queues.error, code),
	);
	const queue = listDenied
		? undefined
		: queues.data?.find((item) => item.key === queueKey);
	const counts = queues.error ? undefined : queue?.counts;
	const status = search.status ?? "waiting";
	const page = search.page ?? 1;
	const pageSize = search.pageSize ?? 20;
	const statusBar = useRef<HTMLDivElement>(null);
	const scrollArea = useRef<HTMLDivElement>(null);
	const scrollKey = JSON.stringify([
		owner.userId,
		owner.generation,
		queueKey,
		status,
		page,
		pageSize,
	]);
	useEffect(() => {
		if (mode !== "browse") return;
		const bar = statusBar.current;
		const active = bar?.querySelector<HTMLElement>(`[data-status="${status}"]`);
		if (bar && active)
			bar.scrollLeft +=
				active.getBoundingClientRect().left -
				bar.getBoundingClientRect().left -
				(bar.clientWidth - active.clientWidth) / 2;
	}, [status, mode]);
	const {
		jobs,
		displayedError,
		busy,
		announcement,
		inputRef,
		draft,
		setDraft,
		runSearch,
		resetSearch,
	} = useQueueJobs(owner);
	const denied = ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].some(
		(code) => isRpcCode(jobs?.error, code) || isRpcCode(queues.error, code),
	);
	const data = denied ? undefined : jobs?.data;
	const total = data && "total" in data ? (data.total ?? 0) : 0;
	const pages = Math.min(10000, Math.max(1, Math.ceil(total / pageSize)));
	const hasData = !!data;
	useEffect(() => {
		if (mode === "browse" && hasData && scrollArea.current) {
			const frame = requestAnimationFrame(() => {
				if (scrollArea.current)
					scrollArea.current.scrollTop = browseScroll.get(scrollKey) ?? 0;
			});
			return () => cancelAnimationFrame(frame);
		}
	}, [mode, scrollKey, hasData]);
	const invalidDraft = draft.length > 0 && !draft.trim();
	const hasDescription = mode === "name" || !!search.query;
	const showFailure = mode !== "browse" || status === "failed";
	useEffect(() => {
		if (
			mode === "browse" &&
			!denied &&
			jobs?.isSuccess &&
			!jobs.isFetching &&
			page > pages
		)
			void navigate({
				replace: true,
				search: (prev) => ({ ...prev, page: pages }),
			});
	}, [mode, denied, jobs?.isSuccess, jobs?.isFetching, page, pages, navigate]);
	return (
		<div
			ref={scrollArea}
			className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto"
		>
			<h1 className="sr-only">{queueKey} jobs</h1>
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b">
				<QueueNav queueKey={queueKey} search={search} />
				<p className="text-muted-foreground text-xs">
					Read only
					{!denied && queue && (queue.paused ? " · Paused" : " · Not paused")}
				</p>
			</div>
			{mode !== "browse" && (
				<ToggleGroup
					type="single"
					value={mode}
					aria-label="Job lookup mode"
					className="w-full"
					onValueChange={(value) => {
						if (
							!value ||
							value === mode ||
							!["browse", "id", "name"].includes(value)
						)
							return;
						resetSearch();
						void navigate({
							search: (prev) => ({
								...prev,
								mode: value === "browse" ? undefined : (value as "id" | "name"),
								query: undefined,
							}),
						});
					}}
				>
					<ToggleGroupItem
						value="id"
						aria-label="Exact job ID"
						className="min-w-0 flex-1 sm:flex-none"
					>
						Exact ID
					</ToggleGroupItem>
					<ToggleGroupItem
						value="name"
						aria-label="Full job name"
						className="min-w-0 flex-1 sm:flex-none"
					>
						Exact name
					</ToggleGroupItem>
				</ToggleGroup>
			)}
			{mode === "browse" ? (
				<div ref={statusBar} className="min-w-0 shrink-0 overflow-x-auto">
					<ToggleGroup
						type="single"
						value={status}
						aria-label="Job states"
						className="w-max"
						onValueChange={(value) => {
							if (
								!value ||
								value === status ||
								!jobStatuses.some((item) => item === value)
							)
								return;
							void navigate({
								search: (prev) => ({
									...prev,
									status:
										value === "waiting" ? undefined : (value as JobStatus),
									page: undefined,
								}),
							});
						}}
					>
						{jobStatuses.map((item) => (
							<ToggleGroupItem
								key={item}
								value={item}
								data-status={item}
								aria-label={jobStatusLabels[item]}
								className="min-h-11 rounded-md border px-2 text-xs data-[state=on]:bg-muted sm:min-h-10 sm:text-sm"
							>
								{jobStatusLabels[item]}{" "}
								<span className="ml-1 text-muted-foreground tabular-nums">
									{!denied ? (counts?.[item]?.toLocaleString() ?? "—") : "—"}
								</span>
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>
			) : (
				<form
					className="flex min-w-0 flex-col gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						void runSearch("search");
					}}
					onKeyDown={(event) => {
						if (
							event.key === "Enter" &&
							(event.repeat || event.nativeEvent.isComposing)
						)
							event.preventDefault();
					}}
				>
					<FieldGroup className="min-w-0 gap-3">
						<Field className="min-w-0 gap-2" data-invalid={invalidDraft}>
							<FieldLabel htmlFor="queue-query">
								{mode === "id" ? "Exact job ID" : "Full job name"}
							</FieldLabel>
							<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
								<Input
									ref={inputRef}
									id="queue-query"
									maxLength={128}
									value={draft}
									onChange={(event) => setDraft(event.target.value)}
									aria-invalid={invalidDraft}
									aria-describedby={
										invalidDraft
											? hasDescription
												? "queue-query-description queue-query-error"
												: "queue-query-error"
											: hasDescription
												? "queue-query-description"
												: undefined
									}
									className="w-full min-w-0 max-w-full sm:w-96"
								/>
								<div className="flex gap-2">
									<Button
										type="submit"
										className="min-h-11 min-w-28 sm:min-h-9"
										aria-busy={busy === "search"}
										disabled={!draft.trim() || !!busy || jobs?.isFetching}
									>
										{busy === "search" ? "Searching…" : "Search"}
									</Button>
									{search.query && (
										<Button
											type="button"
											variant="outline"
											className="min-h-11 min-w-28 sm:min-h-9"
											aria-busy={busy === "refresh"}
											disabled={!!busy || jobs?.isFetching}
											onClick={() => void runSearch("refresh")}
										>
											{busy === "refresh" ? "Refreshing…" : "Refresh"}
										</Button>
									)}
								</div>
							</div>
							{hasDescription && (
								<FieldDescription
									id="queue-query-description"
									className="[overflow-wrap:anywhere]"
								>
									{mode === "name"
										? "Exact name scans up to 100 jobs in each of 7 supported states and returns up to 50 matches. Search is manual; Refresh uses the submitted criteria. Results are not a snapshot."
										: ""}
									{search.query && ` Submitted: ${search.query}.`}
								</FieldDescription>
							)}
							<FieldError id="queue-query-error">
								{invalidDraft ? "Enter a non-empty search." : null}
							</FieldError>
						</Field>
					</FieldGroup>
					<Button
						type="button"
						variant="ghost"
						className="min-h-11 self-start px-0"
						onClick={() =>
							void navigate({
								search: (prev) => ({
									...prev,
									mode: undefined,
									query: undefined,
								}),
							})
						}
					>
						← Back to browsing
					</Button>
				</form>
			)}
			{mode === "browse" && (
				<div className="flex flex-wrap items-center gap-2 text-sm">
					<Button
						variant="outline"
						className="min-h-11 sm:min-h-10"
						onClick={() => {
							browseScroll.set(scrollKey, scrollArea.current?.scrollTop ?? 0);
							void navigate({
								search: (prev) => ({ ...prev, mode: "id", query: undefined }),
							});
						}}
					>
						Find job
					</Button>
					<Button
						variant="outline"
						className="min-h-11 sm:min-h-10"
						onClick={() => {
							void jobs?.refetch();
							void queues.refetch();
						}}
					>
						Refresh
					</Button>
					{data && (
						<span className="text-muted-foreground text-xs">
							Updated {formatTime(Date.parse(data.refreshedAt))} · refreshes
							every 5 seconds
						</span>
					)}
				</div>
			)}
			<div className="sr-only" aria-live="polite">
				{announcement}
			</div>
			{(mode === "browse" || search.query || denied) && (
				<QueueQueryState
					isPending={!denied && (!jobs || jobs.isPending) && !displayedError}
					error={
						denied ? (listDenied ? queues.error : jobs?.error) : displayedError
					}
					hasData={!!data}
					onRetry={() => {
						if (queues.error) void queues.refetch();
						if (mode === "browse") void jobs?.refetch();
						else void runSearch("retry");
					}}
					retryBusy={mode !== "browse" && (busy !== null || jobs?.isFetching)}
				/>
			)}
			{data && (
				<>
					{mode !== "browse" && (
						<div className="flex flex-wrap justify-between gap-2 text-muted-foreground text-sm">
							<span>
								{data.mode === "name"
									? `${data.scannedCount} jobs checked · ${data.items.length} matches returned${data.scanTruncated ? " · More jobs were not scanned" : ""}${data.resultsTruncated ? " · More matches were omitted" : ""}`
									: `${total} matches`}
							</span>
							<span>
								Updated {formatTime(Date.parse(data.refreshedAt))} · manual
								refresh
							</span>
						</div>
					)}
					<QueueJobsTable
						items={data.items}
						showFailure={showFailure}
						mode={mode}
						status={status}
						queueKey={queueKey}
						search={search}
						onJobNavigate={() => {
							if (mode === "browse")
								browseScroll.set(scrollKey, scrollArea.current?.scrollTop ?? 0);
						}}
					/>
					{mode === "browse" && (
						<div className="flex flex-wrap items-center gap-2 text-sm">
							<span className="w-full sm:mr-auto sm:w-auto">
								{total} jobs · Page {page} of {pages} · {pageSize} / page
								{total > 10000 * pageSize &&
									" · Browsing limited to 10,000 pages"}
							</span>
							<Button
								variant="outline"
								className="min-h-11 sm:min-h-9"
								disabled={page <= 1}
								onClick={() =>
									void navigate({
										search: (prev) => ({ ...prev, page: page - 1 }),
									})
								}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								className="min-h-11 sm:min-h-9"
								disabled={page >= pages}
								onClick={() =>
									void navigate({
										search: (prev) => ({ ...prev, page: page + 1 }),
									})
								}
							>
								Next
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
