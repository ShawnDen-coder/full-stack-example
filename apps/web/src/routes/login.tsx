import { createFileRoute, redirect } from "@tanstack/react-router";
import { safeReturnTo } from "@/lib/return-to";
export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: safeReturnTo(search.redirect),
	}),
	beforeLoad: ({ search }) => {
		throw redirect({ to: "/sign-in", search, replace: true });
	},
});
