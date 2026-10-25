import type { AppRouterClient } from "@full-stack-example/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ENV } from "../env";

let identity: string | null | undefined;
let generation = 0;
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
	onUnauthorized = handler;
}
export function synchronizeIdentity(userId: string | null) {
	if (identity === userId) return;
	identity = userId;
	generation++;
	void queryClient.cancelQueries();
	queryClient.clear();
}
export function clearSessionData() {
	identity = undefined;
	synchronizeIdentity(null);
}
function isUnauthorized(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "UNAUTHORIZED"
	);
}
function reportError(error: Error) {
	if (error.name === "AbortError") return;
	if (isUnauthorized(error)) {
		clearSessionData();
		onUnauthorized();
		return;
	}
	toast.error(error.message || "Request failed. Please try again.");
}
export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: (count, error) =>
					!isUnauthorized(error) && error.name !== "AbortError" && count < 2,
			},
		},
		queryCache: new QueryCache({ onError: reportError }),
		mutationCache: new MutationCache({
			onError: (error, _variables, _context, mutation) => {
				if (isUnauthorized(error) || !mutation.options.onError)
					reportError(error);
			},
		}),
	});
}
export const queryClient = createQueryClient();
export const link = new RPCLink({
	url: `${ENV.VITE_SERVER_URL.replace(/\/$/, "")}/rpc`,
	async fetch(request, options) {
		const started = generation;
		const response = await fetch(request, {
			...options,
			credentials: "include",
		});
		// Read the body before handing it to oRPC: identity may change while streaming.
		const body = await response.arrayBuffer();
		if (started !== generation)
			throw new DOMException("Session changed", "AbortError");
		return new Response(body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	},
});
export const client: AppRouterClient = createORPCClient(link);
export const orpc = createTanstackQueryUtils(client);
