import { hashKey, type Query, useQueries } from "@tanstack/react-query";
import { getRouteApi, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
	isScopeCurrent,
	orpc,
	queryClient,
	searchInvalidations,
} from "@/utils/orpc";

const route = getRouteApi("/_auth/queues/$queueKey/jobs/");

export function useQueueJobs(owner: {
	userId: string | null;
	generation: number;
}) {
	const { queueKey } = route.useParams();
	const search = route.useSearch();
	const navigate = route.useNavigate();
	const router = useRouter();
	const routerState = useRouterState();
	const mode = search.mode ?? "browse";
	const status = search.status ?? "waiting";
	const page = search.page ?? 1;
	const pageSize = search.pageSize ?? 20;
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
			isScopeCurrent(owner.userId, owner.generation) &&
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
							if (!isScopeCurrent(owner.userId, owner.generation))
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
									isScopeCurrent(owner.userId, op.ticket)
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
		const target = JSON.stringify([
			queueKey,
			mode,
			term,
			status,
			page,
			pageSize,
		]);
		const location = router.buildLocation({
			to: ".",
			from: "/queues/$queueKey/jobs/",
			search: (prev) => ({ ...prev, query: term }),
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
					search: (prev) => ({ ...prev, query: term }),
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
				isScopeCurrent(owner.userId, token.ticket) &&
				scopeRef.current === scope
			) {
				lastError.current.error = null;
				setAnnouncement(`Search for ${term} completed.`);
				if (kind === "retry")
					requestAnimationFrame(() => {
						if (
							latest.current === token &&
							isScopeCurrent(owner.userId, token.ticket) &&
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
				(!isScopeCurrent(owner.userId, token.ticket) ||
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
	function resetSearch() {
		lock.current = null;
		setBusy(null);
		setDraft("");
		setAnnouncement("");
	}
	return {
		jobs,
		displayedError,
		busy,
		announcement,
		inputRef,
		draft,
		setDraft,
		runSearch,
		resetSearch,
	};
}
