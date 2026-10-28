import { landingPath } from "@full-stack-example/access";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";
export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data)
			throw redirect({ to: "/sign-in", search: { redirect: "/" } });
		const access = await client.access.me();
		throw redirect({ to: landingPath(access), replace: true });
	},
});
