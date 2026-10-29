import "./queue-table.css";
import { Button } from "@full-stack-example/ui/components/button";
import {
	Empty,
	EmptyDescription,
} from "@full-stack-example/ui/components/empty";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@full-stack-example/ui/components/field";
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
	ToggleGroup,
	ToggleGroupItem,
} from "@full-stack-example/ui/components/toggle-group";
import { hashKey, type Query, useQueries } from "@tanstack/react-query";
import {
	getRouteApi,
	Link,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
	identityTicket,
	isIdentityCurrent,
	orpc,
	queryClient,
	searchInvalidations,
} from "@/utils/orpc";
import { failureSummary, formatTime, shortId } from "./format";
import { isRpcCode, QueueQueryState } from "./query-state";
import { QueueNav } from "./queue-nav";
import { type JobStatus, jobStatuses, jobStatusLabels } from "./statuses";

const route = getRouteApi("/_auth/queues/$queueKey/jobs/");
export function QueueJobsScreen() {
	const { queueKey } = route.useParams();
	const search = route.useSearch();
	const navigate = route.useNavigate();
	const router = useRouter();
	const routerState = useRouterState();
	const { session } = route.useRouteContext();
	const owner = useRef({
		userId: session.data?.user.id ?? null,
		generation: identityTicket(),
	}).current;
	const mode = search.mode ?? "browse";
	const status = search.status ?? "waiting";
	const page = search.page ?? 1;
	const pageSize = search.pageSize ?? 20;
	const statusBar = useRef<HTMLDivElement>(null);
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
	const inputRef = useRef<HTMLInputElement>(null);
	const [draft, setDraft] = useState(search.query ?? "");
	useEffect(() => {
		// A new queue or mode owns a separate draft.
		if (queueKey && mode) setDraft(search.query ?? "");
	}, [search.query, queueKey, mode]);
	const scope = JSON.stringify([
		queueKey,
		mode,
		search.query,
		status,
		page,
		pageSize,
	]);
	const lock = useRef<{
		target: string;
		href: string;
		ticket: number;
		query?: Query;
		started: boolean;
		navigation: boolean;
		ownsNavigation: boolean;
		kind: "search" | "refresh";
	} | null>(null);
	const latest = useRef<typeof lock.current>(null);
	const [busy, setBusy] = useState<"search" | "refresh" | null>(null);
	const [announcement, setAnnouncement] = useState("");
	const scopeRef = useRef(scope);
	scopeRef.current = scope;
	const finish = (op: NonNullable<typeof lock.current>, success: boolean) => {
		if (lock.current !== op) return;
		lock.current = null;
		setBusy(null);
		if (success && scopeRef.current === op.target)
			setAnnouncement(`Search for ${search.query} completed.`);
	};
	useEffect(
		() =>
			router.subscribe("onBeforeNavigate", ({ toLocation }) => {
				const op = lock.current;
				if (!op) {
					latest.current = null;
					return;
				}
				if (op.ownsNavigation && !op.navigation && toLocation.href === op.href)
					op.navigation = true;
				else {
					lock.current = null;
					latest.current = null;
					setBusy(null);
				}
			}),
		[router],
	);
	useEffect(
		() => () => {
			lock.current = null;
			latest.current = null;
		},
		[],
	);
	useEffect(() => {
		if (scope) setAnnouncement("");
	}, [scope]);
	const ready = () => {
		const state = router.state;
		const resolved = state.resolvedLocation;
		const match = state.matches.find(
			(item) => item.routeId === "/_auth/queues/$queueKey/jobs/",
		);
		const actual = resolved?.search;
		return (
			isIdentityCurrent(owner.userId, owner.generation) &&
			state.status === "idle" &&
			!state.isLoading &&
			!!resolved &&
			state.location.href === resolved.href &&
			state.location.state.__TSR_key === resolved.state.__TSR_key &&
			match?.status === "success" &&
			match.context.session.data?.user.id === owner.userId &&
			resolved.pathname === routerState.location.pathname &&
			match.params.queueKey === queueKey &&
			(actual?.mode ?? "browse") === mode &&
			actual?.query === search.query &&
			(actual?.status ?? "waiting") === status &&
			(actual?.page ?? 1) === page &&
			(actual?.pageSize ?? 20) === pageSize
		);
	};
	const input = {
		queueKey,
		status,
		page,
		pageSize,
		mode,
		query: mode === "browse" ? undefined : search.query,
	};
	const options = orpc.queues.jobs.queryOptions({ input });
	const queryKey = options.queryKey;
	const queryHash = hashKey(queryKey);
	const op =
		lock.current?.target === scope && lock.current.ticket === owner.generation
			? lock.current
			: null;
	const explicit = () => !!op && lock.current === op && !op.started && ready();
	const markStarted = (query: Query | undefined) => {
		if (explicit() && op && query) {
			op.started = true;
			op.query = query;
		}
	};
	const results = useQueries<
		{ queryFnData: Awaited<ReturnType<typeof options.queryFn>> }[]
	>({
		queries: ready()
			? [
					{
						...options,
						queryKey,
						queryFn: (context: Parameters<typeof options.queryFn>[0]) => {
							if (!isIdentityCurrent(owner.userId, owner.generation))
								throw new DOMException("Session changed", "AbortError");
							markStarted(
								queryClient.getQueryCache().find({ queryKey, exact: true }),
							);
							return options.queryFn(context);
						},
						enabled: mode === "browse" || !!search.query,
						staleTime: mode === "browse" ? undefined : Number.POSITIVE_INFINITY,
						refetchInterval: mode === "browse" ? 5000 : false,
						refetchOnWindowFocus: mode === "browse",
						refetchOnReconnect: mode === "browse",
						refetchOnMount:
							mode === "browse"
								? true
								: () =>
										explicit() || searchInvalidations.has(queryHash)
											? "always"
											: false,
						retryOnMount:
							mode === "browse"
								? true
								: () => explicit() || searchInvalidations.has(queryHash),
						retry: mode === "browse" ? undefined : false,
						refetchIntervalInBackground: false,
						meta: {
							errorHandledLocally: true,
							explicitQueueSearch: mode !== "browse",
							queueSearchJoined: markStarted,
							queueSearchSettled: (query: Query, success: boolean) => {
								if (
									op?.ownsNavigation &&
									op.started &&
									op.query === query &&
									isIdentityCurrent(owner.userId, op.ticket)
								)
									finish(op, success);
							},
						},
					},
				]
			: [],
	});
	const jobs = results[0];
	const runSearch = async (kind: "search" | "refresh" | "retry") => {
		const term = kind === "search" ? draft.trim() : search.query;
		if (!term || lock.current || jobs?.isFetching || !ready()) return;
		const target = JSON.stringify([queueKey, mode, term, status, 1, pageSize]);
		const location = router.buildLocation({
			to: ".",
			from: "/queues/$queueKey/jobs/",
			search: (prev) => ({ ...prev, query: term, page: undefined }),
		});
		const token = {
			target,
			href: location.href,
			ticket: owner.generation,
			started: false,
			query: undefined as Query | undefined,
			navigation: false,
			ownsNavigation: target !== scope,
			kind: kind === "search" ? ("search" as const) : ("refresh" as const),
		};
		lock.current = token;
		latest.current = token;
		setBusy(token.kind);
		setAnnouncement("");
		if (target !== scope) {
			try {
				await navigate({
					search: (prev) => ({ ...prev, query: term, page: undefined }),
				});
			} catch {
				if (lock.current === token) {
					lock.current = null;
					setBusy(null);
				}
			}
			return;
		}
		const retryFocus = document.activeElement;
		token.started = true;
		token.query = queryClient.getQueryCache().find({ queryKey, exact: true });
		try {
			const result = await jobs?.refetch({ cancelRefetch: false });
			if (
				result &&
				!result.error &&
				lock.current === token &&
				isIdentityCurrent(owner.userId, token.ticket) &&
				scopeRef.current === scope
			) {
				lastError.current.error = null;
				setAnnouncement(`Search for ${term} completed.`);
				if (kind === "retry")
					requestAnimationFrame(() => {
						if (
							latest.current === token &&
							isIdentityCurrent(owner.userId, token.ticket) &&
							token.query ===
								queryClient.getQueryCache().find({ queryKey, exact: true }) &&
							ready() &&
							scopeRef.current === scope &&
							(document.activeElement === retryFocus ||
								document.activeElement === document.body)
						)
							inputRef.current?.focus();
					});
			}
		} finally {
			if (
				lock.current === token &&
				(!isIdentityCurrent(owner.userId, token.ticket) ||
					token.query ===
						queryClient.getQueryCache().find({ queryKey, exact: true }))
			) {
				lock.current = null;
				setBusy(null);
			}
		}
	};

	const lastError = useRef<{ scope: string; error: unknown }>({
		scope,
		error: null,
	});
	if (lastError.current.scope !== scope)
		lastError.current = { scope, error: null };
	if (jobs?.error) lastError.current.error = jobs.error;
	else if (jobs?.isSuccess && !jobs.isFetching) lastError.current.error = null;
	const displayedError =
		jobs?.error ?? (busy === "refresh" ? lastError.current.error : null);
	const denied = ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].some((code) =>
		isRpcCode(jobs?.error, code),
	);
	const data = denied ? undefined : jobs?.data;
	const total = data && "total" in data ? (data.total ?? 0) : 0;
	const pages = Math.min(10000, Math.max(1, Math.ceil(total / pageSize)));
	const invalidDraft = draft.length > 0 && !draft.trim();
	const showFailure = mode !== "browse" || status === "failed";
	useEffect(() => {
		if (
			mode === "browse" &&
			jobs?.isSuccess &&
			!jobs.isFetching &&
			page > pages
		)
			void navigate({
				replace: true,
				search: (prev) => ({ ...prev, page: pages }),
			});
	}, [mode, jobs?.isSuccess, jobs?.isFetching, page, pages, navigate]);
	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="min-w-0">
					<h1 className="font-bold text-2xl tracking-tight">Queues</h1>
					<p className="break-all text-muted-foreground">{queueKey} · Jobs</p>
				</div>
				<QueueNav queueKey={queueKey} search={search} />
			</div>
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
					lock.current = null;
					setBusy(null);
					setDraft("");
					setAnnouncement("");
					void navigate({
						search: () => ({
							mode: value === "browse" ? undefined : (value as "id" | "name"),
						}),
					});
				}}
			>
				<ToggleGroupItem value="browse" className="min-w-0 flex-1 sm:flex-none">
					Browse
				</ToggleGroupItem>
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
					Full name
				</ToggleGroupItem>
			</ToggleGroup>
			{mode === "browse" ? (
				<div ref={statusBar} className="min-w-0 overflow-x-auto border-b">
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
								className="rounded-none border-transparent border-b-2 data-[state=on]:border-foreground data-[state=on]:bg-transparent"
							>
								{jobStatusLabels[item]}
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
											? "queue-query-description queue-query-error"
											: "queue-query-description"
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
							<FieldDescription
								id="queue-query-description"
								className="[overflow-wrap:anywhere]"
							>
								{mode === "name"
									? "All states, limited search: up to 100 jobs per state. Results are not a snapshot."
									: "Find a job by its exact ID."}
								{search.query && ` Current search: ${search.query}.`}
							</FieldDescription>
							<FieldError id="queue-query-error">
								{invalidDraft ? "Enter a non-empty search." : null}
							</FieldError>
						</Field>
					</FieldGroup>
				</form>
			)}
			<div className="sr-only" aria-live="polite">
				{announcement}
			</div>
			{(mode === "browse" || search.query) && (
				<QueueQueryState
					isPending={(!jobs || jobs.isPending) && !displayedError}
					error={displayedError}
					hasData={!!data}
					onRetry={() =>
						mode === "browse" ? void jobs?.refetch() : void runSearch("retry")
					}
					retryBusy={mode !== "browse" && (busy !== null || jobs?.isFetching)}
				/>
			)}
			{data && (
				<>
					<div className="flex flex-wrap justify-between gap-2 text-muted-foreground text-sm">
						<span>
							{data.mode === "name"
								? `${data.scannedCount} jobs checked · ${data.items.length} matches returned${data.scanTruncated ? " · More jobs were not scanned" : ""}${data.resultsTruncated ? " · More matches were omitted" : ""}`
								: `${total} ${mode === "browse" ? "jobs" : "matches"}`}
						</span>
						<span>Updated {formatTime(Date.parse(data.refreshedAt))}</span>
					</div>
					<div className="min-h-48 flex-1 overflow-auto rounded-md border">
						<Table className="queue-table queue-jobs-table">
							<TableHeader>
								<TableRow>
									<TableHead>Job</TableHead>
									<TableHead>User ID</TableHead>
									<TableHead className="text-right">Attempts</TableHead>
									<TableHead className="text-right">Created</TableHead>
									<TableHead className="text-right">Finished</TableHead>
									{showFailure && <TableHead>Failure</TableHead>}
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.items.length ? (
									data.items.map((job) => (
										<TableRow key={job.id}>
											<TableCell>
												<Link
													to="/queues/$queueKey/jobs/$jobId"
													params={{ queueKey, jobId: job.id }}
													search={search}
													className="font-medium hover:underline"
												>
													{job.name}
												</Link>
												<div className="text-muted-foreground text-xs">
													<span className="font-mono" title={job.id}>
														{shortId(job.id)}
													</span>{" "}
													· {job.state}
												</div>
											</TableCell>
											<TableCell>
												<span className="queue-field-label">User ID</span>
												<span title={job.summary.userId}>
													{job.summary.userId
														? shortId(job.summary.userId)
														: "—"}
												</span>
											</TableCell>
											<TableCell className="text-right tabular-nums">
												<span className="queue-field-label">Attempts</span>
												<span>
													{job.attemptsMade} / {job.attemptsConfigured ?? "—"}
												</span>
											</TableCell>
											<TableCell className="text-right">
												<span className="queue-field-label">Created</span>
												<span>{formatTime(job.timestamp)}</span>
											</TableCell>
											<TableCell className="text-right">
												<span className="queue-field-label">Finished</span>
												<span>{formatTime(job.finishedOn)}</span>
											</TableCell>
											{showFailure && (
												<TableCell>
													<span className="queue-field-label">Failure</span>
													<span title={failureSummary(job.failedReason)}>
														{failureSummary(job.failedReason)}
													</span>
												</TableCell>
											)}
										</TableRow>
									))
								) : (
									<TableRow>
										<TableCell
											colSpan={showFailure ? 6 : 5}
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
					{mode === "browse" && (
						<div className="flex items-center gap-2 text-sm">
							<span>
								Page {page} of {pages}
								{total > 10000 * pageSize &&
									" · Browsing limited to 10,000 pages"}
							</span>
							<Button
								variant="outline"
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
