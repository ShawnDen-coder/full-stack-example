import { buttonVariants } from "@full-stack-example/ui/components/button";
import { Icon } from "@full-stack-example/ui/components/icon";
import { Separator } from "@full-stack-example/ui/components/separator";
import { cn } from "@full-stack-example/ui/lib/utils";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Palette, UserRound } from "lucide-react";
export const Route = createFileRoute("/_auth/settings")({
	component: Settings,
});
function Settings() {
	const items = [
		{ title: "Profile", to: "/settings", icon: UserRound },
		{ title: "Appearance", to: "/settings/appearance", icon: Palette },
	] as const;
	return (
		<>
			<div className="space-y-0.5">
				<h1 className="font-bold text-3xl tracking-tight">Settings</h1>
				<p className="text-muted-foreground">
					Manage your profile and workspace appearance.
				</p>
			</div>
			<Separator className="my-6" />
			<div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
				<aside className="shrink-0 lg:w-1/5">
					<nav aria-label="Settings" className="flex gap-1 lg:flex-col">
						{items.map((item) => (
							<Link
								key={item.to}
								to={item.to}
								activeOptions={{ exact: true }}
								className={cn(
									buttonVariants({ variant: "ghost" }),
									"justify-start",
								)}
								activeProps={{
									className: "bg-muted hover:bg-accent",
									"aria-current": "page",
								}}
							>
								<Icon icon={item.icon} size="toolbar" />
								{item.title}
							</Link>
						))}
					</nav>
				</aside>
				<div className="min-w-0 flex-1">
					<Outlet />
				</div>
			</div>
		</>
	);
}
