import { AuthProvider } from "@better-auth-ui/react";
import {
	useDeleteRole,
	useListOrganizationMembers,
	useListRoles,
} from "@better-auth-ui/react/plugins/organization";
import { defaultMemberRole, pages } from "@full-stack-example/access";
import { Button } from "@full-stack-example/ui/components/button";
import { Input } from "@full-stack-example/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@full-stack-example/ui/components/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@full-stack-example/ui/components/tabs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { EditMemberRolesDialog } from "@/components/auth/organization/edit-member-roles-dialog";
import {
	type Role,
	RoleDialog,
} from "@/components/auth/organization/role-dialog";
import { useAccess } from "@/lib/access";
import { organizationPlugin } from "@/lib/auth/organization-plugin";
import { authClient } from "@/lib/auth-client";
import { useWorkspaceId } from "@/lib/workspace";
import { client } from "@/utils/orpc";

const permissions = Object.fromEntries(
	pages
		.filter((page) => page.key !== "queues")
		.map((page) => [
			page.key,
			{ label: page.title, actions: { read: `View ${page.title}` } },
		]),
);
const plugin = organizationPlugin({
	allowMultipleRoles: true,
	roles: {
		owner: "Workspace owner",
		admin: "Administrator",
		member: "User",
	},
	dynamicAccessControl: { enabled: true, permissions },
});

export function AdminUsers() {
	const workspaceId = useWorkspaceId();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	return (
		<AuthProvider
			authClient={authClient}
			queryClient={queryClient}
			navigate={(options) => {
				void navigate({ to: options.to, replace: options.replace });
			}}
			plugins={[plugin]}
		>
			<AccessManagement key={workspaceId} />
		</AuthProvider>
	);
}

function AccessManagement() {
	const dialogTrigger = useRef<HTMLButtonElement | null>(null);
	const restoreFocus = (event: Event) => {
		const active = document.activeElement;
		event.preventDefault();
		if (
			active === document.body ||
			(active instanceof Element && active.closest('[role="dialog"]'))
		) {
			dialogTrigger.current?.focus();
		}
	};
	const access = useAccess();
	const workspaceId = useWorkspaceId() ?? "";
	const [email, setEmail] = useState("");
	const addMember = useMutation({
		mutationFn: () => client.access.addMember({ workspaceId, email }),
		onSuccess: () => {
			setEmail("");
			void members.refetch();
		},
	});
	const queryClient = useQueryClient();
	const [offset, setOffset] = useState(0);
	const [search, setSearch] = useState("");
	const [editingRole, setEditingRole] = useState<Role | null>();
	const [editingMember, setEditingMember] = useState<{
		id: string;
		role: string;
	}>();
	const members = useListOrganizationMembers(authClient, {
		query: { organizationId: workspaceId, limit: 25, offset },
	});
	const roles = useListRoles(authClient, {
		query: { organizationId: workspaceId },
	});
	const deleteRole = useDeleteRole(authClient, workspaceId, {
		onError: (error) => toast.error(error.message),
	});
	const owner = access.data?.workspaceRole?.split(",").includes("owner");
	const roleOptions: Array<[string, string]> = [
		...(owner ? [["admin", "Administrator"] as [string, string]] : []),
		["member", "User"],
		...(roles.data ?? []).map(
			(role) => [role.role, role.role] as [string, string],
		),
	];
	function refreshAccess() {
		void queryClient.invalidateQueries({ queryKey: ["access"] });
	}
	const visibleMembers = (members.data?.members ?? []).filter((member) =>
		`${member.user.name} ${member.user.email}`
			.toLowerCase()
			.includes(search.toLowerCase()),
	);
	return (
		<div>
			<div className="mb-6">
				<h1 className="font-semibold text-2xl">Users and access</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					Assign page access through roles. Changes apply to everyone with that
					role.
				</p>
			</div>
			<Tabs defaultValue="members">
				<TabsList>
					<TabsTrigger value="members">Members</TabsTrigger>
					<TabsTrigger value="roles">Page roles</TabsTrigger>
				</TabsList>
				<TabsContent value="members" className="space-y-4 pt-4">
					<form
						className="flex max-w-lg gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							addMember.mutate();
						}}
					>
						<Input
							type="email"
							required
							aria-label="Member email"
							placeholder="Existing account email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
						<Button disabled={addMember.isPending || !email}>Add member</Button>
					</form>
					<Input
						className="max-w-sm"
						aria-label="Filter this page of members"
						placeholder="Filter this page by name or email"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					{members.isError ? (
						<p role="alert">
							Could not load members.{" "}
							<Button variant="link" onClick={() => void members.refetch()}>
								Retry
							</Button>
						</p>
					) : members.isPending ? (
						<p>Loading members…</p>
					) : (
						<>
							<Table className="w-full">
								<TableHeader className="hidden lg:table-header-group">
									<TableRow>
										<TableHead>User</TableHead>
										<TableHead>Roles</TableHead>
										<TableHead>
											<span className="sr-only">Actions</span>
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody className="block lg:table-row-group">
									{visibleMembers.map((member) => (
										<TableRow
											key={member.id}
											className="grid grid-cols-[minmax(0,1fr)_auto] lg:table-row"
										>
											<TableCell className="col-span-2 min-w-0 whitespace-normal break-all lg:max-w-52">
												<div>{member.user.name}</div>
												<div className="text-muted-foreground text-sm">
													{member.user.email}
												</div>
											</TableCell>
											<TableCell className="min-w-0 whitespace-normal break-words">
												{member.role}
											</TableCell>
											<TableCell>
												<Button
													variant="outline"
													aria-label={`Edit roles for ${member.user.email}`}
													disabled={
														member.role.split(",").includes("owner") ||
														(!owner && member.role.split(",").includes("admin"))
													}
													onClick={(event) => {
														dialogTrigger.current = event.currentTarget;
														setEditingMember(member);
													}}
												>
													Edit roles
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
							{!visibleMembers.length && (
								<p className="text-muted-foreground text-sm">
									No matching members on this page.
								</p>
							)}
							<div className="flex items-center gap-3">
								<Button
									variant="outline"
									disabled={offset === 0}
									onClick={() => setOffset(Math.max(0, offset - 25))}
								>
									Previous
								</Button>
								<span className="text-sm">
									{members.data?.total ?? 0} members
								</span>
								<Button
									variant="outline"
									disabled={offset + 25 >= (members.data?.total ?? 0)}
									onClick={() => setOffset(offset + 25)}
								>
									Next
								</Button>
							</div>
						</>
					)}
				</TabsContent>
				<TabsContent value="roles" className="space-y-4 pt-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="text-muted-foreground text-sm">
							New members receive the standard role. Tools also require platform
							enablement.
						</p>
						<Button
							onClick={(event) => {
								dialogTrigger.current = event.currentTarget;
								setEditingRole(null);
							}}
						>
							Create role
						</Button>
					</div>
					{roles.isError ? (
						<p role="alert">
							Could not load roles.{" "}
							<Button variant="link" onClick={() => void roles.refetch()}>
								Retry
							</Button>
						</p>
					) : roles.isPending ? (
						<p>Loading roles…</p>
					) : (
						<Table className="w-full">
							<TableHeader className="hidden lg:table-header-group">
								<TableRow>
									<TableHead>Role</TableHead>
									<TableHead>Role grants</TableHead>
									<TableHead>
										<span className="sr-only">Actions</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody className="block lg:table-row-group">
								{roles.data?.map((role) => (
									<TableRow
										key={role.id}
										className="grid grid-cols-[minmax(0,1fr)_auto] lg:table-row"
									>
										<TableCell className="col-span-2 break-all">
											{role.role}
										</TableCell>
										<TableCell className="min-w-0 whitespace-normal break-words">
											{pages
												.filter((page) =>
													role.permission[page.key]?.includes("read"),
												)
												.map((page) => page.title)
												.join(", ") || "None"}
										</TableCell>
										<TableCell>
											<div className="flex gap-2">
												<Button
													variant="outline"
													aria-label={`Edit ${role.role}`}
													onClick={(event) => {
														dialogTrigger.current = event.currentTarget;
														setEditingRole(role);
													}}
												>
													Edit
												</Button>
												<Button
													variant="ghost"
													disabled={
														role.role === defaultMemberRole ||
														deleteRole.isPending
													}
													onClick={() => {
														if (
															window.confirm(
																`Delete role “${role.role}”? Roles in use cannot be deleted.`,
															)
														)
															deleteRole.mutate({
																roleId: role.id,
																organizationId: workspaceId,
															});
													}}
												>
													Delete
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</TabsContent>
			</Tabs>
			<RoleDialog
				onCloseAutoFocus={restoreFocus}
				open={editingRole !== undefined}
				role={editingRole ?? undefined}
				organizationId={workspaceId}
				registry={permissions}
				onOpenChange={(open) => {
					if (!open) {
						setEditingRole(undefined);
						refreshAccess();
					}
				}}
			/>
			{editingMember && (
				<EditMemberRolesDialog
					onCloseAutoFocus={restoreFocus}
					open
					member={editingMember}
					organizationId={workspaceId}
					roles={roleOptions}
					onOpenChange={(open) => {
						if (!open) {
							setEditingMember(undefined);
							refreshAccess();
						}
					}}
				/>
			)}
		</div>
	);
}
