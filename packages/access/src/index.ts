export const roles = ["user", "admin", "superadmin"] as const;
export type Role = (typeof roles)[number];
export const pages = [
	{ key: "todos", title: "Todos", path: "/todos" },
	{ key: "dashboard", title: "Dashboard", path: "/dashboard" },
	{ key: "tasks", title: "Tasks", path: "/tasks" },
	{
		key: "apps",
		title: "Integration examples",
		path: "/apps/integrations-demo",
	},
	{ key: "chats", title: "Chats", path: "/chats" },
	{ key: "queues", title: "Queues", path: "/queues" },
] as const;
export const pageKeys = [
	"todos",
	"dashboard",
	"tasks",
	"apps",
	"chats",
	"queues",
] as const;
export type PageKey = (typeof pageKeys)[number];
export const defaultMemberRole = "standard";
export const workspaceToolKeys = ["todos"] as const;
export type WorkspaceToolKey = (typeof workspaceToolKeys)[number];
export type Access = {
	role: Role;
	platformRole?: "user" | "superadmin";
	workspaceRole?: string;
	pages: PageKey[];
	organizationId?: string;
};
export function canVisit(access: Access, pathname: string): boolean {
	const path = pathname.replace(/\/+$/, "") || "/";
	if (path === "/apps") return true;
	if (
		path === "/workspaces" ||
		path === "/queues" ||
		path.startsWith("/queues/")
	)
		return access.platformRole === "superadmin";
	if (path === "/admin" || path.startsWith("/admin/") || path === "/users")
		return access.role !== "user";
	const page = pages.find(
		(entry) =>
			path === entry.path ||
			(entry.key !== "apps" && path.startsWith(`${entry.path}/`)),
	);
	if (page) return access.pages.includes(page.key);
	return (
		path === "/settings" ||
		path.startsWith("/settings/") ||
		path === "/help-center" ||
		path === "/no-access"
	);
}
export function landingPath(_access: Access) {
	return "/apps" as const;
}
