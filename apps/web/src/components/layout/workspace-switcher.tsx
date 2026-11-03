import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@full-stack-example/ui/components/dropdown-menu";
import { Icon } from "@full-stack-example/ui/components/icon";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@full-stack-example/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Building2, ChevronsUpDown, Settings2 } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { WorkspaceLogo } from "@/features/workspaces/workspace-logo";
import { WorkspaceSettings } from "@/features/workspaces/workspace-settings";
import { useAccess } from "@/lib/access";
import { useWorkspaceId } from "@/lib/workspace";
import { client } from "@/utils/orpc";

export function WorkspaceSwitcher() {
	const workspaceId = useWorkspaceId();
	const [settingsFor, setSettingsFor] = useState<string>();
	const previousWorkspace = useRef(workspaceId);
	useLayoutEffect(() => {
		if (previousWorkspace.current !== workspaceId) {
			previousWorkspace.current = workspaceId;
			setSettingsFor(undefined);
		}
	}, [workspaceId]);
	const switcherTrigger = useRef<HTMLButtonElement>(null);
	const access = useAccess();
	const spaces = useQuery({
		queryKey: ["workspaces", "mine"],
		queryFn: () => client.access.mine(),
		staleTime: 0,
	});
	const navigate = useNavigate();
	const { isMobile } = useSidebar();
	const current = spaces.data?.find((item) => item.id === workspaceId);
	const canManage = Boolean(
		current &&
			access.data?.workspaceRole
				?.split(",")
				.some((role) => role === "owner" || role === "admin"),
	);
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							ref={switcherTrigger}
							size="lg"
							className="group-data-[collapsible=icon]:h-12!"
							tooltip={current?.name ?? "Workspaces"}
							aria-label={`Switch workspace: ${current?.name ?? "None selected"}`}
						>
							{current ? (
								<div className="size-8 shrink-0 [&>span]:size-8">
									<WorkspaceLogo
										id={current.id}
										name={current.name}
										hasLogo={current.hasLogo}
									/>
								</div>
							) : (
								<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
									<Icon icon={Building2} />
								</div>
							)}
							<span className="truncate font-semibold">
								{current?.name ?? "Workspaces"}
							</span>
							<Icon icon={ChevronsUpDown} className="ml-auto" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side={isMobile ? "bottom" : "right"}
						align="start"
						className="w-64"
					>
						<DropdownMenuLabel>Workspaces</DropdownMenuLabel>
						{current && (
							<DropdownMenuLabel className="font-normal text-muted-foreground">
								{current.name} · {current.slug} · {access.data?.workspaceRole}
							</DropdownMenuLabel>
						)}
						{spaces.isError ? (
							<DropdownMenuItem onSelect={() => void spaces.refetch()}>
								Unable to load. Retry
							</DropdownMenuItem>
						) : spaces.isPending ? (
							<DropdownMenuItem disabled>Loading…</DropdownMenuItem>
						) : spaces.data.length ? (
							<DropdownMenuRadioGroup
								value={workspaceId ?? ""}
								onValueChange={(id) =>
									void navigate({ to: "/apps", search: { workspace: id } })
								}
							>
								{spaces.data.map((space) => (
									<DropdownMenuRadioItem key={space.id} value={space.id}>
										<span className="truncate">{space.name}</span>
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						) : (
							<DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
						)}
						{canManage && workspaceId && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onSelect={() =>
										void navigate({
											to: "/admin/users",
											search: { workspace: workspaceId },
										})
									}
								>
									<Icon icon={Settings2} />
									Members &amp; access
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setSettingsFor(workspaceId)}>
									<Icon icon={Settings2} />
									Workspace settings
								</DropdownMenuItem>
							</>
						)}
						{access.data?.platformRole === "superadmin" && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onSelect={() => void navigate({ to: "/workspaces" })}
								>
									<Icon icon={Settings2} />
									Manage all workspaces
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
				{settingsFor === workspaceId && settingsFor && canManage && current && (
					<WorkspaceSettings
						key={current.id}
						space={current}
						restoreFocus={() => switcherTrigger.current?.focus()}
						open
						onOpenChange={(next) =>
							setSettingsFor(next ? workspaceId : undefined)
						}
					/>
				)}
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
