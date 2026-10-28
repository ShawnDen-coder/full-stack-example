import { useNavigate } from "@tanstack/react-router";
import SignInForm from "@/components/sign-in-form";
import { safeReturnTo } from "@/lib/return-to";
export function UserAuthForm({ redirectTo }: { redirectTo?: string }) {
	const navigate = useNavigate();
	return (
		<SignInForm
			returnTo={safeReturnTo(redirectTo)}
			onSwitchToSignUp={() =>
				void navigate({ to: "/sign-up", search: { redirect: "/tasks" } })
			}
		/>
	);
}
