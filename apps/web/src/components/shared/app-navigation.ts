import CheckBoxOutlinedIcon from "@mui/icons-material/CheckBoxOutlined";
import { z } from "zod";
import type { FileRoutesByTo } from "../../routeTree.gen.js";

export const navigationIconRegistry = {
  todos: CheckBoxOutlinedIcon,
} as const;

export type NavigationRole = "owner" | "admin" | "member";
type NavigationTo = keyof FileRoutesByTo;

export type NavigationPage = {
  readonly kind: "page";
  readonly id: string;
  readonly label: string;
  readonly to: NavigationTo;
  readonly iconKey: keyof typeof navigationIconRegistry;
  readonly exact?: boolean;
  readonly roles?: readonly NavigationRole[];
};

export type NavigationGroup = {
  readonly kind: "group";
  readonly id: string;
  readonly label: string;
  readonly iconKey: keyof typeof navigationIconRegistry;
  readonly children: readonly NavigationPage[];
};

export type NavigationEntry = NavigationPage | NavigationGroup;
export type NavigationSection = {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavigationEntry[];
};

const navigationRoleSchema = z.enum(["owner", "admin", "member"]);
const iconKeySchema = z.string().refine((value) => value in navigationIconRegistry, "未知图标");

const navigationPageSchema = z.object({
  kind: z.literal("page"),
  id: z.string().min(1),
  label: z.string().min(1),
  to: z.string().startsWith("/"),
  iconKey: iconKeySchema,
  exact: z.boolean().optional(),
  roles: z.array(navigationRoleSchema).readonly().optional(),
});

const navigationGroupSchema = z.object({
  kind: z.literal("group"),
  id: z.string().min(1),
  label: z.string().min(1),
  iconKey: iconKeySchema,
  children: z.array(navigationPageSchema).min(1),
});

const navigationSchema = z.array(
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    items: z.array(z.discriminatedUnion("kind", [navigationPageSchema, navigationGroupSchema])),
  }),
);

export function defineNavigation<const T extends readonly NavigationSection[]>(value: T): T {
  navigationSchema.parse(value);
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const section of value) {
    assertUnique(ids, section.id, "导航区块");
    for (const item of section.items) {
      assertUnique(ids, item.id, "导航项");
      if (item.kind === "page") {
        assertUnique(paths, item.to, "导航路径");
      } else {
        for (const child of item.children) {
          assertUnique(ids, child.id, "导航项");
          assertUnique(paths, child.to, "导航路径");
        }
      }
    }
  }
  return value;
}

function assertUnique(values: Set<string>, value: string, label: string) {
  if (values.has(value)) throw new Error(`${label}重复：${value}`);
  values.add(value);
}

export const appNavigation = defineNavigation([
  {
    id: "workspace",
    label: "工作台",
    items: [
      {
        kind: "page",
        id: "todos",
        label: "待办事项",
        to: "/todos",
        iconKey: "todos",
        exact: true,
      },
    ],
  },
] as const);

export function filterNavigation(
  sections: readonly NavigationSection[],
  role: NavigationRole | undefined,
) {
  return sections
    .map((section): NavigationSection => {
      const items: NavigationEntry[] = [];
      for (const item of section.items) {
        if (item.kind === "page") {
          if (isVisible(item, role)) items.push(item);
          continue;
        }
        const children = item.children.filter((child) => isVisible(child, role));
        if (children.length > 0) items.push({ ...item, children });
      }
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);
}

export function normalizeNavigationRole(value: string | undefined): NavigationRole | undefined {
  if (value === "owner" || value === "admin" || value === "member") return value;
  return undefined;
}

function isVisible(item: NavigationPage, role: NavigationRole | undefined) {
  return !item.roles || (role !== undefined && item.roles.includes(role));
}
