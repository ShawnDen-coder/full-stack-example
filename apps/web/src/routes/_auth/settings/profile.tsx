import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_auth/settings/profile")({
	beforeLoad: () => {
		throw redirect({ to: "/settings", replace: true });
	},
});
