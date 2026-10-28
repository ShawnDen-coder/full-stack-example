import { Icon } from "@full-stack-example/ui/components/icon";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
} from "@full-stack-example/ui/components/sidebar";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Layers, ListTodo, Settings } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { NavigationSearch } from "@/components/navigation-search";
import UserMenu from "@/components/user-menu";
import { Header } from "./header";
import { Main } from "./main";

export function AppLayout() {
	const { pathname } = useLocation();
	const defaultOpen = !document.cookie
		.split("; ")
		.includes("sidebar_state=false");
	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			<Sidebar collapsible="icon" variant="inset">
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton size="lg" asChild tooltip="FullStack">
								<Link to="/tasks">
									<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
										<Icon icon={Layers} size="logo" />
									</div>
									<span className="font-semibold">FullStack</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>Workspace</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										asChild
										tooltip="Tasks"
										isActive={pathname === "/tasks"}
									>
										<Link to="/tasks" activeProps={{ "aria-current": "page" }}>
											<Icon icon={ListTodo} />
											<span>Tasks</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										asChild
										tooltip="Settings"
										isActive={pathname.startsWith("/settings")}
									>
										<Link to="/settings" activeOptions={{ exact: false }}>
											<Icon icon={Settings} />
											<span>Settings</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter>
					<UserMenu />
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>
			<SidebarInset className="@container/content min-w-0">
				<Header>
					<NavigationSearch />
					<div className="ms-auto">
						<ModeToggle />
					</div>
				</Header>
				<Main id="content" tabIndex={-1}>
					<Outlet />
				</Main>
			</SidebarInset>
		</SidebarProvider>
	);
}
