import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

type User = {
	name: string;
	email: string;
	avatar: string;
};

type Team = {
	name: string;
	logo: React.ElementType;
	plan: string;
};

type BaseNavItem = {
	title: string;
	badge?: string;
	icon?: LucideIcon;
};

type NavLink = BaseNavItem & {
	url: LinkProps["to"] | (string & {});
	items?: never;
};

type NavCollapsible = BaseNavItem & {
	items: (BaseNavItem & { url: LinkProps["to"] | (string & {}) })[];
	url?: never;
};

type NavItem = NavCollapsible | NavLink;

type NavGroup = {
	title: string;
	items: NavItem[];
};

type SidebarData = {
	user: User;
	teams: Team[];
	navGroups: NavGroup[];
};

export type { NavCollapsible, NavGroup, NavItem, NavLink, SidebarData };
