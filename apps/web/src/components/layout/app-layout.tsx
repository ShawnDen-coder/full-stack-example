import { canVisit, landingPath } from "@full-stack-example/access";
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
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Logo } from "@/assets/logo";
import { ConfigDrawer } from "@/components/config-drawer";
import { ModeToggle } from "@/components/mode-toggle";
import { NavigationSearch } from "@/components/navigation-search";
import UserMenu from "@/components/user-menu";
import { DirectionProvider } from "@/context/direction-provider";
import { LayoutProvider, useLayout } from "@/context/layout-provider";
import { useAccess, visibleNavigation } from "@/lib/access";
import { queryClient } from "@/utils/orpc";

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
	const access = useAccess();
	const navigate = useNavigate();
	const previous = useRef<string | undefined>(undefined);
	const signature = JSON.stringify(access.data);
	useEffect(() => {
		if (!access.data) return;
		if (previous.current && previous.current !== signature) {
			void queryClient.cancelQueries({
				predicate: (q) => q.queryKey[0] !== "access",
			});
			queryClient.removeQueries({
				predicate: (q) => q.queryKey[0] !== "access",
			});
		}
		previous.current = signature;
		if (!canVisit(access.data, pathname))
			void navigate({ to: "/no-access", replace: true });
	}, [access.data, signature, pathname, navigate]);
	if (!access.data)
		return (
			<p role={access.isError ? "alert" : "status"}>
				{access.isError
					? "Unable to verify page access."
					: "Loading page access…"}
				<button type="button" onClick={() => void access.refetch()}>
					Retry
				</button>
			</p>
		);
	const navGroups = visibleNavigation(access.data);
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
								<Link to={landingPath(access.data)}>
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
					{navGroups.map((group) => (
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
					{canVisit(access.data, pathname) ? <Outlet /> : null}
				</Main>
			</SidebarInset>
		</SidebarProvider>
	);
}
