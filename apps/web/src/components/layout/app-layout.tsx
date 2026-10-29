import { canVisit } from "@full-stack-example/access";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarProvider,
	SidebarRail,
} from "@full-stack-example/ui/components/sidebar";
import {
	Outlet,
	useLocation,
	useMatches,
	useNavigate,
} from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ConfigDrawer } from "@/components/config-drawer";
import Loader from "@/components/loader";
import { ModeToggle } from "@/components/mode-toggle";
import { NavigationSearch } from "@/components/navigation-search";
import UserMenu from "@/components/user-menu";
import { DirectionProvider } from "@/context/direction-provider";
import { LayoutProvider, useLayout } from "@/context/layout-provider";
import { useAccess, visibleNavigation } from "@/lib/access";
import { useWorkspaceId } from "@/lib/workspace";
import { queryClient, synchronizeWorkspace } from "@/utils/orpc";
import { Header } from "./header";
import { Main } from "./main";
import { NavGroup } from "./nav-group";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function AppLayout() {
	return (
		<DirectionProvider>
			<LayoutProvider>
				<WorkspaceBoundary />
			</LayoutProvider>
		</DirectionProvider>
	);
}
function WorkspaceBoundary() {
	const workspaceId = useWorkspaceId();
	const [committed, setCommitted] = useState<{ id?: string }>();
	useLayoutEffect(() => {
		synchronizeWorkspace(workspaceId);
		setCommitted({ id: workspaceId });
	}, [workspaceId]);
	if (!committed || committed.id !== workspaceId) return <Loader />;
	return <AppLayoutInner />;
}

function AppLayoutInner() {
	const { variant, collapsible } = useLayout();
	const { pathname } = useLocation();
	const matches = useMatches();
	const fixed = matches.some((match) => match.staticData.layout === "fixed");
	const fluid = matches.some((match) => match.staticData.layout === "fluid");
	const workspaceId = useWorkspaceId();
	const access = useAccess();
	const navigate = useNavigate();
	const previous = useRef<{ signature: string; workspaceId?: string }>(
		undefined,
	);
	const signature = JSON.stringify(access.data);
	useEffect(() => {
		if (!access.data) return;
		if (
			previous.current &&
			previous.current.workspaceId === workspaceId &&
			previous.current.signature !== signature
		) {
			void queryClient.cancelQueries({
				predicate: (q) => q.queryKey[0] !== "access",
			});
			queryClient.removeQueries({
				predicate: (q) => q.queryKey[0] !== "access",
			});
		}
		previous.current = { signature, workspaceId };
		if (!canVisit(access.data, pathname))
			void navigate({ to: "/no-access", replace: true });
	}, [access.data, signature, pathname, navigate, workspaceId]);
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
					<WorkspaceSwitcher />
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
				<Main fixed={fixed} fluid={fluid} id="content" tabIndex={-1}>
					{canVisit(access.data, pathname) ? (
						<Outlet key={workspaceId} />
					) : null}
				</Main>
			</SidebarInset>
		</SidebarProvider>
	);
}
