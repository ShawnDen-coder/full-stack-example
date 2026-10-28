import {
	Avatar,
	AvatarFallback,
} from "@full-stack-example/ui/components/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
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
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, LogOut, Palette, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { clearSessionData } from "@/utils/orpc";
export default function UserMenu() {
	const navigate = useNavigate();
	const { isMobile } = useSidebar();
	const { data: session } = authClient.useSession();
	const [pending, setPending] = useState(false);
	if (!session) return null;
	const { user } = session;
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							aria-label={user.name}
							className="data-[state=open]:bg-sidebar-accent"
						>
							<Avatar className="size-8 rounded-lg">
								<AvatarFallback className="rounded-lg">
									{user.name.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<span className="grid flex-1 text-start text-sm leading-tight">
								<span className="truncate font-semibold">{user.name}</span>
								<span className="truncate text-xs">{user.email}</span>
							</span>
							<Icon icon={ChevronsUpDown} className="ms-auto" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side={isMobile ? "bottom" : "right"}
						align="end"
						className="min-w-56 rounded-lg"
					>
						<DropdownMenuLabel>My Account</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Link to="/settings">
								<Icon icon={UserRound} />
								Profile
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link to="/settings/appearance">
								<Icon icon={Palette} />
								Appearance
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							disabled={pending}
							onSelect={async () => {
								if (pending) return;
								setPending(true);
								try {
									const result = await authClient.signOut();
									if (result.error) throw new Error(result.error.message);
									clearSessionData();
									await navigate({
										to: "/sign-in",
										search: { redirect: "/tasks" },
									});
								} catch {
									toast.error("Sign out failed. Please retry.");
								} finally {
									setPending(false);
								}
							}}
						>
							<Icon icon={LogOut} />
							{pending ? "Signing out…" : "Sign Out"}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
