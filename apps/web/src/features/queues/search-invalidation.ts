import type { QueryClient } from "@tanstack/react-query";

// An explicit invalidation can outlive an observer. Versioning ensures an older
// in-flight result cannot consume an intent recorded with refetchType: "none".
export function trackSearchInvalidations(client: QueryClient) {
	const pending = new Map<string, number>();
	let sequence = 0;
	const cache = client.getQueryCache();
	cache.subscribe((event) => {
		if (event.type === "removed") pending.delete(event.query.queryHash);
		if (event.type === "updated" && event.action.type === "fetch")
			pending.delete(event.query.queryHash);
		if (
			event.type === "updated" &&
			(event.action.type === "success" || event.action.type === "error") &&
			event.query.state.fetchStatus === "idle"
		) {
			const settled = event.query.meta?.queueSearchSettled;
			if (typeof settled === "function")
				settled(event.query, event.action.type === "success");
		}
		if (
			event.type === "observerAdded" &&
			event.query.state.fetchStatus !== "idle"
		) {
			const join = event.observer.options.meta?.queueSearchJoined;
			if (typeof join === "function") join(event.query);
			pending.delete(event.query.queryHash);
		}
	});
	const invalidate = client.invalidateQueries.bind(client);
	const refetch = client.refetchQueries.bind(client);
	client.refetchQueries = (filters, options) => {
		const candidates = cache
			.findAll(filters)
			.filter((query) => !query.isDisabled() && !query.isStatic())
			.map((query) => [query, pending.get(query.queryHash)] as const);
		const promise = refetch(filters, options);
		for (const [query, version] of candidates) {
			if (
				version !== undefined &&
				query.state.fetchStatus !== "idle" &&
				pending.get(query.queryHash) === version
			)
				pending.delete(query.queryHash);
		}
		return promise;
	};
	client.invalidateQueries = (filters, options) => {
		for (const query of cache.findAll(filters)) {
			if (query.meta?.explicitQueueSearch === true)
				pending.set(query.queryHash, ++sequence);
		}
		return invalidate(filters, options);
	};
	return { has: (hash: string) => pending.has(hash) };
}
