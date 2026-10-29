import { createFileRoute, redirect } from "@tanstack/react-router";
import { ToolCenter } from "@/features/tool-center";
export const Route = createFileRoute("/_auth/apps")({
	beforeLoad: ({ location }) => {
		const params = new URLSearchParams(location.searchStr);
		if (["type", "filter", "sort"].some((key) => params.has(key)))
			throw redirect({ to: "/apps", search: {}, replace: true });
	},
	component: ToolCenter,
});
