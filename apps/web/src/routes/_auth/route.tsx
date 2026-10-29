import { canVisit } from "@full-stack-example/access";
import {
	createFileRoute,
	redirect,
	retainSearchParams,
} from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/app-layout";
import Loader from "@/components/loader";
import { accessOptions } from "@/lib/access";
import { authClient } from "@/lib/auth-client";
import { safeReturnTo } from "@/lib/return-to";
import { queryClient, synchronizeIdentity } from "@/utils/orpc";

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
	validateSearch: (
		search: Record<string, unknown>,
	): { workspace?: string } => ({
		workspace:
			typeof search.workspace === "string" && search.workspace.length <= 100
				? search.workspace
				: undefined,
	}),
	search: { middlewares: [retainSearchParams(["workspace"])] },
	beforeLoad: async ({ location, search }) => {
		const session = await authClient.getSession();
		if (session.error)
			throw new Error("Unable to verify your session. Please retry.");
		synchronizeIdentity(session.data?.user.id ?? null);
		if (!session.data) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: safeReturnTo(location.href) },
			});
		}
		const access = await queryClient.fetchQuery(
			accessOptions(search.workspace),
		);
		if (!search.workspace && access.organizationId)
			throw redirect({
				href: `${location.pathname}?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.searchStr)), workspace: access.organizationId })}`,
				replace: true,
			});
		if (!canVisit(access, location.pathname))
			throw redirect({ to: "/no-access" });
		return { session, access };
	},
});

function AuthLayout() {
	const { session } = Route.useRouteContext();
	const live = authClient.useSession();
	if (
		live.isPending ||
		!live.data ||
		live.data.user.id !== session.data?.user.id
	)
		return <Loader />;
	return <AppLayout />;
}
