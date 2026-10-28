export const roles = ["user", "admin", "superadmin"] as const;
export type Role = (typeof roles)[number];
export const pages = [
	{ key: "todos", title: "Todos", path: "/todos" },
	{ key: "dashboard", title: "Dashboard", path: "/dashboard" },
	{ key: "tasks", title: "Tasks", path: "/tasks" },
	{ key: "apps", title: "Apps", path: "/apps" },
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
export const workspaceId = "application";
export const defaultMemberRole = "standard";
export type Access = {
	role: Role;
	pages: PageKey[];
	organizationId?: string;
};
export function canVisit(access: Access, pathname: string): boolean {
	const path = pathname.replace(/\/+$/, "") || "/";
	if (path === "/admin" || path.startsWith("/admin/") || path === "/users")
		return access.role !== "user";
	const page = pages.find(
		(entry) => path === entry.path || path.startsWith(`${entry.path}/`),
	);
	if (page) return access.pages.includes(page.key);
	return (
		path === "/settings" ||
		path.startsWith("/settings/") ||
		path === "/help-center" ||
		path === "/no-access"
	);
}
export function landingPath(access: Access) {
	return (
		pages.find((page) => access.pages.includes(page.key))?.path ??
		(access.role !== "user" ? "/admin/users" : "/no-access")
	);
}
