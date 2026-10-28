import "./queue-table.css";
import { Input } from "@full-stack-example/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@full-stack-example/ui/components/table";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@full-stack-example/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
import { DataTablePagination } from "@/components/data-table";
import { useTableUrlState } from "@/hooks/use-table-url-state";
import { type client, orpc } from "@/utils/orpc";
import { failureSummary, formatTime, shortId } from "./format";
import { QueueQueryState } from "./query-state";
import { QueueNav } from "./queue-nav";
import { type JobStatus, jobStatuses, jobStatusLabels } from "./statuses";

const route = getRouteApi("/_auth/queues/$queueKey/jobs/");

type JobRow = Awaited<ReturnType<typeof client.queues.jobs>>["items"][number];

function jobColumns(
	queueKey: string,
	search: ReturnType<typeof route.useSearch>,
): ColumnDef<JobRow>[] {
	const columns: ColumnDef<JobRow>[] = [
		{
			accessorKey: "name",
			header: "Job",
			cell: ({ row }) => (
				<div className="min-w-0">
					<Link
						to="/queues/$queueKey/jobs/$jobId"
						params={{ queueKey, jobId: row.original.id }}
						search={search}
						className="font-medium hover:underline"
					>
						{row.original.name}
					</Link>
					<div
						title={row.original.id}
						className="font-mono text-muted-foreground text-xs"
					>
						{shortId(row.original.id)}
						<span className="ml-2 font-sans">{row.original.state}</span>
					</div>
				</div>
			),
		},
		{
			id: "userId",
			header: "User ID",
			cell: ({ row }) => (
				<span
					title={row.original.summary.userId}
					className="font-mono text-muted-foreground text-xs"
				>
					{row.original.summary.userId
						? shortId(row.original.summary.userId)
						: "—"}
				</span>
			),
		},
		{
			id: "attempts",
			header: "Attempts",
			cell: ({ row }) => (
				<div className="text-right tabular-nums">
					{row.original.attemptsMade} / {row.original.attemptsConfigured ?? "—"}
				</div>
			),
		},
		{
			accessorKey: "timestamp",
			header: "Created",
			cell: ({ row }) => (
				<div className="text-right text-muted-foreground tabular-nums">
					{formatTime(row.original.timestamp)}
				</div>
			),
		},
		{
			accessorKey: "finishedOn",
			header: "Finished",
			cell: ({ row }) => (
				<div className="text-right text-muted-foreground tabular-nums">
					{formatTime(row.original.finishedOn)}
				</div>
			),
		},
	];
	if (search.status === "failed")
		columns.push({
			accessorKey: "failedReason",
			header: "Failure",
			cell: ({ row }) => (
				<span
					className="block max-w-72 truncate"
					title={failureSummary(row.original.failedReason)}
				>
					{failureSummary(row.original.failedReason)}
				</span>
			),
		});
	return columns;
}

export function QueueJobsScreen() {
	const { queueKey } = route.useParams();
	const search = route.useSearch();
	const columns = jobColumns(queueKey, search);
	const [focused, setFocused] = useState(false);
	const queues = useQuery({
		...orpc.queues.list.queryOptions(),
		refetchInterval: focused ? false : 5000,
		meta: { errorHandledLocally: true },
	});
	const counts = queues.data?.find((queue) => queue.key === queueKey)?.counts;
	const navigate = route.useNavigate();
	const status: JobStatus = search.status ?? "waiting";
	const [filter, setFilter] = useState(search.jobId ?? "");
	useEffect(() => {
		setFilter(search.jobId ?? "");
	}, [search.jobId]);
	useEffect(() => {
		const timer = setTimeout(() => {
			if (filter.trim() !== (search.jobId ?? ""))
				void navigate({
					replace: true,
					search: (prev) => ({
						...prev,
						jobId: filter.trim() || undefined,
						page: undefined,
					}),
				});
		}, 350);
		return () => clearTimeout(timer);
	}, [filter, search.jobId, navigate]);
	const tabsRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const tabs = tabsRef.current;
		const active = tabs?.querySelector<HTMLElement>(
			`[data-status="${status}"]`,
		);
		if (tabs && active)
			tabs.scrollLeft +=
				active.getBoundingClientRect().left -
				tabs.getBoundingClientRect().left -
				(tabs.clientWidth - active.clientWidth) / 2;
	}, [status]);
	const page = search.page ?? 1;
	const pageSize = search.pageSize ?? 20;
	const {
		globalFilter,
		onGlobalFilterChange,
		columnFilters,
		onColumnFiltersChange,
		pagination,
		onPaginationChange,
		ensurePageInRange,
	} = useTableUrlState({
		search,
		navigate,
		pagination: { defaultPage: 1, defaultPageSize: 20 },
		globalFilter: { enabled: true, key: "jobId" },
		columnFilters: [],
	});
	const jobs = useQuery({
		...orpc.queues.jobs.queryOptions({
			input: {
				queueKey,
				status,
				page,
				pageSize,
				jobId: search.jobId,
			},
		}),
		placeholderData: (previous) => previous,
		refetchInterval: focused ? false : 5000,
		refetchIntervalInBackground: false,
		meta: { errorHandledLocally: true },
	});
	const lastData = useRef<typeof jobs.data>(undefined);
	if (jobs.isSuccess && !jobs.isPlaceholderData) lastData.current = jobs.data;
	const displayedData = jobs.data ?? lastData.current;
	const requestKey = JSON.stringify([
		queueKey,
		status,
		page,
		pageSize,
		search.jobId,
	]);
	const request = useRef({ key: requestKey, baseline: jobs.dataUpdatedAt });
	if (request.current.key !== requestKey) {
		request.current = { key: requestKey, baseline: jobs.dataUpdatedAt };
	}
	const table = useReactTable({
		data: displayedData?.items ?? [],
		columns,
		state: { pagination, globalFilter, columnFilters },
		manualPagination: true,
		manualFiltering: true,
		rowCount: displayedData?.total ?? 0,
		pageCount: Math.min(
			10000,
			Math.max(1, Math.ceil((displayedData?.total ?? 0) / pageSize)),
		),
		onPaginationChange,
		onGlobalFilterChange,
		onColumnFiltersChange,
		getCoreRowModel: getCoreRowModel(),
	});
	const pageCount = table.getPageCount();
	useEffect(() => {
		if (
			jobs.isSuccess &&
			!jobs.isFetching &&
			!jobs.isPlaceholderData &&
			jobs.dataUpdatedAt > request.current.baseline &&
			jobs.data?.page === page &&
			jobs.data.pageSize === pageSize
		)
			ensurePageInRange(pageCount, { resetTo: "last" });
	}, [
		pageCount,
		ensurePageInRange,
		jobs.isSuccess,
		jobs.isFetching,
		jobs.isPlaceholderData,
		jobs.dataUpdatedAt,
		jobs.data,
		page,
		pageSize,
	]);
	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Queues</h1>
					<p className="text-muted-foreground">{queueKey} · Jobs</p>
				</div>
				<QueueNav queueKey={queueKey} search={search} />
			</div>
			<Tabs
				ref={tabsRef}
				className="min-w-0 overflow-x-auto"
				value={status}
				onValueChange={(value) => {
					setFilter("");
					void navigate({
						search: (previous) => ({
							...previous,
							status: value === "waiting" ? undefined : (value as JobStatus),
							page: undefined,
							jobId: undefined,
						}),
					});
				}}
			>
				<TabsList className="h-auto w-max justify-start rounded-none border-b bg-transparent p-0">
					{jobStatuses.map((item) => (
						<TabsTrigger
							key={item}
							value={item}
							data-status={item}
							className="min-h-11 flex-none rounded-none border-0 border-transparent border-b-2 px-3 shadow-none data-[state=active]:border-foreground data-[state=active]:shadow-none"
						>
							{jobStatusLabels[item]}{" "}
							<span className="ml-1 tabular-nums">
								{counts?.[item]?.toLocaleString() ?? "—"}
							</span>
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<QueueQueryState
				isPending={jobs.isPending}
				error={jobs.error}
				hasData={!!displayedData}
				onRetry={() => void jobs.refetch()}
			/>
			{displayedData && (
				<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
					<div className="flex items-center justify-between gap-4">
						<Input
							aria-label="Exact job ID or name"
							placeholder="Exact job ID or name"
							maxLength={128}
							value={filter}
							onFocus={() => setFocused(true)}
							onBlur={() => setFocused(false)}
							onChange={(event) => setFilter(event.target.value)}
							className="h-11 w-full sm:h-9 sm:max-w-72"
						/>
						<span className="shrink-0 text-muted-foreground text-sm tabular-nums">
							{displayedData.total.toLocaleString()} jobs
						</span>
					</div>
					<div className="min-h-0 flex-1 overflow-auto rounded-md border">
						<Table className="queue-table queue-jobs-table">
							<TableHeader>
								{table.getHeaderGroups().map((group) => (
									<TableRow key={group.id}>
										{group.headers.map((header) => (
											<TableHead
												key={header.id}
												className={
													["attempts", "timestamp", "finishedOn"].includes(
														header.id,
													)
														? "text-right"
														: ""
												}
											>
												{header.isPlaceholder
													? null
													: flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
											</TableHead>
										))}
									</TableRow>
								))}
							</TableHeader>
							<TableBody>
								{table.getRowModel().rows.length ? (
									table.getRowModel().rows.map((row) => (
										<TableRow key={row.id}>
											{row.getVisibleCells().map((cell) => (
												<TableCell
													key={cell.id}
													data-label={
														typeof cell.column.columnDef.header === "string"
															? cell.column.columnDef.header
															: undefined
													}
												>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</TableCell>
											))}
										</TableRow>
									))
								) : (
									<TableRow>
										<TableCell
											colSpan={columns.length}
											className="h-24 text-center"
										>
											{search.jobId
												? "No job with that ID or name."
												: "No jobs in this state."}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
					{page <= 10000 && <DataTablePagination table={table} />}
				</div>
			)}
		</div>
	);
}
