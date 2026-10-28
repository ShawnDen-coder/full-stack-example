import type { Access } from "@full-stack-example/access";
import { canVisit } from "@full-stack-example/access";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { sidebarData } from "@/components/layout/data/sidebar-data";
import type { NavItem } from "@/components/layout/types";
import { client } from "@/utils/orpc";
export const accessOptions = () =>
	queryOptions({
		queryKey: ["access", "me"],
		queryFn: () => client.access.me(),
		staleTime: 0,
		retry: false,
		refetchOnWindowFocus: "always",
	});
export function useAccess() {
	return useQuery(accessOptions());
}
export function visibleNavigation(access: Access) {
	return sidebarData.navGroups
		.map((group) => ({
			...group,
			items: group.items.flatMap<NavItem>((item) => {
				if (item.items) {
					const items = item.items.filter((child) =>
						canVisit(access, child.url ?? ""),
					);
					return items.length ? [{ ...item, items }] : [];
				}
				return canVisit(access, item.url ?? "") ? [item] : [];
			}),
		}))
		.filter((group) => group.items.length);
}
