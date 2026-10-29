import { useSearch } from "@tanstack/react-router";

export function useWorkspaceId() {
	return useSearch({ strict: false, select: (search) => search.workspace });
}
