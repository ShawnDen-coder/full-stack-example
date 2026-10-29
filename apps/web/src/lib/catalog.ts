import {
	type Access,
	canVisit,
	type PageKey,
	pages,
} from "@full-stack-example/access";
import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	Clock,
	LayoutDashboard,
	ListTodo,
	MessageSquare,
	Package,
	Settings,
	ShieldCheck,
	SquareCheckBig,
} from "lucide-react";

export const catalogGroups = [
	{ id: "workspace", label: "Workspace" },
	{ id: "tools", label: "Tools" },
	{ id: "admin", label: "Administration" },
	{ id: "account", label: "Account" },
	{ id: "demo", label: "Template examples" },
] as const;
type Common = {
	id: string;
	title: string;
	url: NonNullable<LinkProps["to"]>;
	icon: LucideIcon;
	description: string;
	match: "exact" | "prefix";
};
export type CatalogEntry = Common &
	(
		| { kind: "shell"; group: "workspace" }
		| { kind: "real"; group: "tools" }
		| { kind: "admin"; group: "admin" }
		| { kind: "account"; group: "account" }
		| { kind: "demo"; group: "demo" }
	);

const path = (key: PageKey) => {
	const entry = pages.find((page) => page.key === key);
	if (!entry) throw new Error(`Missing page ${key}`);
	return entry.path;
};
export const catalog = [
	{
		id: "tool-center",
		title: "Tool center",
		url: "/apps",
		icon: Package,
		group: "workspace",
		description: "Find the tools available to your account.",
		match: "exact",
		kind: "shell",
	},
	{
		id: "todos",
		title: "Todos",
		url: path("todos"),
		icon: SquareCheckBig,
		group: "tools",
		description: "Manage your personal tasks.",
		match: "exact",
		kind: "real",
	},
	{
		id: "queues",
		title: "Queues",
		url: path("queues"),
		icon: Clock,
		group: "tools",
		description: "Read-only queue and job monitoring.",
		match: "prefix",
		kind: "real",
	},
	{
		id: "users",
		title: "Users and access",
		url: "/admin/users",
		icon: ShieldCheck,
		group: "admin",
		description: "Manage users and page permissions.",
		match: "exact",
		kind: "admin",
	},
	{
		id: "profile",
		title: "Profile",
		url: "/settings",
		icon: Settings,
		group: "account",
		description: "Update your profile.",
		match: "exact",
		kind: "account",
	},
	{
		id: "appearance",
		title: "Appearance",
		url: "/settings/appearance",
		icon: Settings,
		group: "account",
		description: "Choose your appearance.",
		match: "exact",
		kind: "account",
	},

	{
		id: "dashboard",
		title: "Dashboard example",
		url: path("dashboard"),
		icon: LayoutDashboard,
		group: "demo",
		description: "Explore a sample dashboard.",
		match: "exact",
		kind: "demo",
	},
	{
		id: "tasks",
		title: "Tasks example",
		url: path("tasks"),
		icon: ListTodo,
		group: "demo",
		description: "Explore a sample task table.",
		match: "exact",
		kind: "demo",
	},
	{
		id: "integrations",
		title: "Integration examples",
		url: path("apps"),
		icon: Package,
		group: "demo",
		description: "Browse sample integrations.",
		match: "exact",
		kind: "demo",
	},
	{
		id: "chats",
		title: "Chats example",
		url: path("chats"),
		icon: MessageSquare,
		group: "demo",
		description: "Explore a sample inbox.",
		match: "exact",
		kind: "demo",
	},
] as const satisfies readonly CatalogEntry[];
export function visibleCatalog(access: Access) {
	return catalog.filter((entry) => canVisit(access, entry.url));
}
