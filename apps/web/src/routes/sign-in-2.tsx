import { createFileRoute, redirect } from "@tanstack/react-router";
import { SignIn2 } from "@/features/auth/sign-in/sign-in-2";
import { authClient } from "@/lib/auth-client";
import { safeReturnTo } from "@/lib/return-to";
export const Route = createFileRoute("/sign-in-2")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: safeReturnTo(search.redirect),
	}),
	beforeLoad: async ({ search }) => {
		const session = await authClient.getSession();
		if (session.data) throw redirect({ to: search.redirect, replace: true });
	},
	component: SignIn2,
});
