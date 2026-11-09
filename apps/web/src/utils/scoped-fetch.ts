export function createScopedFetch(scopeTicket: () => number) {
	return async (request: Request, options: RequestInit) => {
		const started = scopeTicket();
		const response = await fetch(request, {
			...options,
			credentials: "include",
		});
		const body = await response.arrayBuffer();
		if (started !== scopeTicket())
			throw new DOMException("Session changed", "AbortError");
		return new Response(body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	};
}
