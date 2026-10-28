import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth-layout";
import SignInForm from "@/components/sign-in-form";
import { authClient } from "@/lib/auth-client";
import { safeReturnTo } from "@/lib/return-to";
export const Route = createFileRoute("/sign-in")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: safeReturnTo(search.redirect),
	}),
	beforeLoad: async ({ search }) => {
		const session = await authClient.getSession();
		if (session.data) throw redirect({ to: search.redirect, replace: true });
	},
	component: Page,
});
function Page() {
	const { redirect: returnTo } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<AuthLayout>
			<SignInForm
				returnTo={returnTo}
				onSwitchToSignUp={() =>
					void navigate({ to: "/sign-up", search: { redirect: returnTo } })
				}
			/>
		</AuthLayout>
	);
}
