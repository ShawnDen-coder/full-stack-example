import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { safeReturnTo } from "@/lib/return-to";

export const Route = createFileRoute("/login")({
	component: RouteComponent,
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: safeReturnTo(search.redirect),
	}),
});

function RouteComponent() {
	const { redirect } = Route.useSearch();
	const [showSignIn, setShowSignIn] = useState(true);

	return showSignIn ? (
		<SignInForm
			returnTo={redirect}
			onSwitchToSignUp={() => setShowSignIn(false)}
		/>
	) : (
		<SignUpForm
			returnTo={redirect}
			onSwitchToSignIn={() => setShowSignIn(true)}
		/>
	);
}
