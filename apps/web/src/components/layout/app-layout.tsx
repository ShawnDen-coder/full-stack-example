import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
} from "@full-stack-example/ui/components/sidebar";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Logo } from "@/assets/logo";
import { ConfigDrawer } from "@/components/config-drawer";
import { ModeToggle } from "@/components/mode-toggle";
import { NavigationSearch } from "@/components/navigation-search";
import UserMenu from "@/components/user-menu";
import { DirectionProvider } from "@/context/direction-provider";
import { LayoutProvider, useLayout } from "@/context/layout-provider";
import { sidebarData } from "./data/sidebar-data";
import { Header } from "./header";
import { Main } from "./main";
import { NavGroup } from "./nav-group";

export function AppLayout() {
	return (
		<DirectionProvider>
			<LayoutProvider>
				<AppLayoutInner />
			</LayoutProvider>
		</DirectionProvider>
	);
}
function AppLayoutInner() {
	const { variant, collapsible } = useLayout();
	const { pathname } = useLocation();
	const defaultOpen = !document.cookie
		.split("; ")
		.includes("sidebar_state=false");
	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			<Sidebar collapsible={collapsible} variant={variant}>
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton size="lg" asChild tooltip="FullStack">
								<Link to="/dashboard">
									<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
										<Logo />
									</div>
									<span className="font-semibold">FullStack</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>
				<SidebarContent>
					{sidebarData.navGroups.map((group) => (
						<NavGroup key={group.title} {...group} />
					))}
				</SidebarContent>
				<SidebarFooter>
					<UserMenu />
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>
			<SidebarInset className="@container/content min-w-0 has-data-[layout=fixed]:h-svh peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]">
				<Header>
					<NavigationSearch />
					<div className="ms-auto flex items-center gap-2">
						<ModeToggle />
						<ConfigDrawer />
					</div>
				</Header>
				<Main
					fixed={["/tasks", "/apps", "/users", "/chats"].includes(pathname)}
					id="content"
					tabIndex={-1}
				>
					<Outlet />
				</Main>
			</SidebarInset>
		</SidebarProvider>
	);
}
