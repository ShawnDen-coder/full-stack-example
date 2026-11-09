import type { AppRouterClient } from "@full-stack-example/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ENV } from "../env";
import { trackSearchInvalidations } from "../features/queues/search-invalidation";
import {
	invalidateIdentityScope,
	scopeTicket,
	updateIdentityScope,
	updateWorkspaceScope,
} from "./request-scope";
import { createScopedFetch } from "./scoped-fetch";

export { isScopeCurrent, scopeTicket } from "./request-scope";

export function synchronizeWorkspace(workspaceId: string | undefined) {
	if (!updateWorkspaceScope(workspaceId)) return;
	void queryClient.cancelQueries();
	queryClient.removeQueries({
		predicate: (query) =>
			!(query.queryKey[0] === "access" && query.queryKey[2] === workspaceId),
	});
	queryClient.getMutationCache().clear();
}
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
	onUnauthorized = handler;
}
export function synchronizeIdentity(userId: string | null) {
	if (!updateIdentityScope(userId)) return;
	void queryClient.cancelQueries();
	queryClient.clear();
}
export function clearSessionData() {
	invalidateIdentityScope();
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
					!isUnauthorized(error) &&
					!(
						"code" in error &&
						(error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
					) &&
					error.name !== "AbortError" &&
					count < 2,
			},
		},
		queryCache: new QueryCache({
			onError: (error, query) => {
				if (
					"code" in error &&
					(error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
				) {
					query.setState({ data: undefined, dataUpdatedAt: 0 });
				}
				if ("code" in error && error.code === "FORBIDDEN") {
					void queryClient.invalidateQueries({ queryKey: ["access", "me"] });
				}
				// Authentication failures must always reach the session boundary.
				if (isUnauthorized(error) || !query.meta?.errorHandledLocally)
					reportError(error);
			},
		}),
		mutationCache: new MutationCache({
			onError: (error, _variables, _context, mutation) => {
				if ("code" in error && error.code === "FORBIDDEN") {
					void queryClient.invalidateQueries({ queryKey: ["access", "me"] });
				}
				if (isUnauthorized(error) || !mutation.options.onError)
					reportError(error);
			},
		}),
	});
}
export const queryClient = createQueryClient();
export const searchInvalidations = trackSearchInvalidations(queryClient);
export const link = new RPCLink({
	url: `${ENV.VITE_SERVER_URL.replace(/\/$/, "")}/rpc`,
	fetch: createScopedFetch(scopeTicket),
});
export const client: AppRouterClient = createORPCClient(link);
export const orpc = createTanstackQueryUtils(client);
