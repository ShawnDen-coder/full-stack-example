import { Separator } from "@full-stack-example/ui/components/separator";
import { Outlet } from "@tanstack/react-router";
import { Bell, Monitor, Palette, UserCog, Wrench } from "lucide-react";
import { SidebarNav } from "./components/sidebar-nav";

const sidebarNavItems = [
	{
		title: "Profile",
		href: "/settings",
		icon: <UserCog size={18} />,
	},
	{
		title: "Account",
		href: "/settings/account",
		icon: <Wrench size={18} />,
	},
	{
		title: "Appearance",
		href: "/settings/appearance",
		icon: <Palette size={18} />,
	},
	{
		title: "Notifications",
		href: "/settings/notifications",
		icon: <Bell size={18} />,
	},
	{
		title: "Display",
		href: "/settings/display",
		icon: <Monitor size={18} />,
	},
];

export function Settings() {
	return (
		<>
			{/* ===== Top Heading ===== */}

			<div className="flex flex-1 flex-col">
				<div className="space-y-0.5">
					<h1 className="font-bold text-2xl tracking-tight md:text-3xl">
						Settings
					</h1>
					<p className="text-muted-foreground">
						Manage your account settings and set e-mail preferences.
					</p>
				</div>
				<Separator className="my-4 lg:my-6" />
				<div className="flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-x-12 lg:space-y-0">
					<aside className="top-0 shrink-0 lg:sticky lg:w-1/5">
						<SidebarNav items={sidebarNavItems} />
					</aside>
					<div className="flex min-w-0 flex-1 p-1">
						<Outlet />
					</div>
				</div>
			</div>
		</>
	);
}
