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
import { useAccess } from "@/lib/access";
import { useWorkspaceId } from "@/lib/workspace";
import { client } from "@/utils/orpc";

export function WorkspaceSwitcher() {
	const workspaceId = useWorkspaceId();
	const access = useAccess();
	const spaces = useQuery({
		queryKey: ["workspaces", "mine"],
		queryFn: () => client.access.mine(),
		staleTime: 0,
	});
	const navigate = useNavigate();
	const { isMobile } = useSidebar();
	const current = spaces.data?.find((item) => item.id === workspaceId);
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							tooltip={current?.name ?? "Workspaces"}
							aria-label={`Switch workspace: ${current?.name ?? "None selected"}`}
						>
							<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
								<Icon icon={Building2} />
							</div>
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
						{access.data?.platformRole === "superadmin" && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onSelect={() => void navigate({ to: "/workspaces" })}
								>
									<Icon icon={Settings2} />
									Manage workspaces
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
