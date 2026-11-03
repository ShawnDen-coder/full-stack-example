import type { QueryClient } from "@tanstack/react-query";

// Reset clears old data and cancels in-flight results without orphaning observers.
export function resetAccessQueries(
	client: QueryClient,
	keepWorkspaceList: boolean,
) {
	// This list is platform-superadmin-only and independent of workspace grants.
	// Keeping it avoids closing its active settings dialog during a tool change.
	const predicate = (query: { queryKey: readonly unknown[] }) =>
		query.queryKey[0] !== "access" &&
		!(
			keepWorkspaceList &&
			query.queryKey[0] === "workspaces" &&
			query.queryKey[1] === "all"
		);
	void client.cancelQueries({ predicate });
	void client.resetQueries({ predicate });
}
