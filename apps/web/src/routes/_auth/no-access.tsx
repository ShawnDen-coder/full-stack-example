import { createFileRoute, Link } from "@tanstack/react-router";
export const Route = createFileRoute("/_auth/no-access")({
	component: NoAccess,
});
function NoAccess() {
	return (
		<section className="space-y-4">
			<h1 className="font-semibold text-2xl">Page access required</h1>
			<p className="text-muted-foreground">
				Ask an administrator to enable the pages you need.
			</p>
			<Link className="underline" to="/settings/account">
				Account settings
			</Link>
		</section>
	);
}
