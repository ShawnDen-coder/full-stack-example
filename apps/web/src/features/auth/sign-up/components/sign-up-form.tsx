import { useNavigate, useSearch } from "@tanstack/react-router";
import SignUpFormImpl from "@/components/sign-up-form";
import { safeReturnTo } from "@/lib/return-to";
export function SignUpForm() {
	const navigate = useNavigate();
	const search = useSearch({ strict: false });
	return (
		<SignUpFormImpl
			returnTo={safeReturnTo(search.redirect)}
			onSwitchToSignIn={() =>
				void navigate({
					to: "/sign-in",
					search: { redirect: safeReturnTo(search.redirect) },
				})
			}
		/>
	);
}
