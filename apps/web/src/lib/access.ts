import type { Access } from "@full-stack-example/access";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { catalogGroups, visibleCatalog } from "@/lib/catalog";
import { client } from "@/utils/orpc";
import { useWorkspaceId } from "./workspace";
export const accessOptions = (workspaceId?: string) =>
	queryOptions({
		queryKey: ["access", "me", workspaceId],
		queryFn: () => client.access.me({ workspaceId }),
		staleTime: 0,
		retry: false,
		refetchOnWindowFocus: "always",
	});
export function useAccess() {
	return useQuery(accessOptions(useWorkspaceId()));
}
export function visibleNavigation(access: Access) {
	const entries = visibleCatalog(access);
	return catalogGroups
		.map(({ id, label }) => ({
			title: label,
			items: entries
				.filter((entry) => entry.group === id)
				.map(({ title, url, icon, match }) => ({ title, url, icon, match })),
		}))
		.filter((group) => group.items.length);
}
