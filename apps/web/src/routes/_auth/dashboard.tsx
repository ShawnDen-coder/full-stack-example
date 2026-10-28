import { Button } from "@full-stack-example/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const { session } = Route.useRouteContext();

	const privateData = useQuery({
		...orpc.privateData.queryOptions(),
		queryKey: ["user", session.data?.user.id, "privateData"],
		meta: { errorHandledLocally: true },
	});

	return (
		<div className="mx-auto w-full max-w-3xl space-y-4 p-4 py-10">
			<h1 className="font-semibold text-2xl">Dashboard</h1>
			<p>Welcome {session.data?.user.name}</p>
			{privateData.isPending && <p role="status">Loading dashboard...</p>}
			{privateData.isError && (
				<div role="alert" className="space-y-2">
					<p>
						{privateData.data
							? "Unable to refresh your dashboard. Showing previously loaded data."
							: "Unable to load your dashboard."}
					</p>
					<Button
						variant="outline"
						disabled={privateData.isFetching}
						onClick={() => void privateData.refetch()}
					>
						{privateData.isFetching ? "Retrying..." : "Retry"}
					</Button>
				</div>
			)}
			{privateData.data && <p>API: {privateData.data.message}</p>}
		</div>
	);
}
