import { describe, expect, it } from "vitest";
import {
  appNavigation,
  defineNavigation,
  filterNavigation,
  normalizeNavigationRole,
} from "../../../src/components/shared/app-navigation.js";

describe("app navigation registry", () => {
  it("keeps the real Todo page registered", () => {
    expect(appNavigation[0]?.items[0]).toMatchObject({ id: "todos", to: "/todos" });
  });

  it("filters pages and empty groups by role", () => {
    const sections = defineNavigation([
      {
        id: "workspace",
        label: "工作台",
        items: [
          { kind: "page", id: "all", label: "全部", to: "/todos", iconKey: "todos" },
          {
            kind: "page",
            id: "admin",
            label: "管理",
            to: "/workspaces",
            iconKey: "todos",
            roles: ["admin"],
          },
          {
            kind: "group",
            id: "owner-group",
            label: "仅限所有者",
            iconKey: "todos",
            children: [
              {
                kind: "page",
                id: "owner",
                label: "所有者",
                to: "/workspaces/new",
                iconKey: "todos",
                roles: ["owner"],
              },
            ],
          },
        ],
      },
    ] as const);

    expect(filterNavigation(sections, "member")[0]?.items.map((item) => item.id)).toEqual(["all"]);
    expect(filterNavigation(sections, "admin")[0]?.items.map((item) => item.id)).toEqual([
      "all",
      "admin",
    ]);
    expect(filterNavigation(sections, "owner")[0]?.items.map((item) => item.id)).toEqual([
      "all",
      "owner-group",
    ]);
  });

  it("rejects duplicate ids, duplicate paths, empty groups, and nested groups", () => {
    expect(() =>
      defineNavigation([
        {
          id: "section",
          label: "区块",
          items: [
            { kind: "page", id: "same", label: "一", to: "/todos", iconKey: "todos" },
            { kind: "page", id: "same", label: "二", to: "/workspaces", iconKey: "todos" },
          ],
        },
      ] as const),
    ).toThrow("导航项重复");

    expect(() =>
      defineNavigation([
        {
          id: "section",
          label: "区块",
          items: [
            { kind: "page", id: "one", label: "一", to: "/todos", iconKey: "todos" },
            { kind: "page", id: "two", label: "二", to: "/todos", iconKey: "todos" },
          ],
        },
      ] as const),
    ).toThrow("导航路径重复");

    expect(() =>
      defineNavigation([
        {
          id: "section",
          label: "区块",
          items: [{ kind: "group", id: "empty", label: "空", iconKey: "todos", children: [] }],
        },
      ] as const),
    ).toThrow();

    expect(() =>
      defineNavigation([
        {
          id: "section",
          label: "区块",
          items: [
            {
              kind: "group",
              id: "nested",
              label: "嵌套",
              iconKey: "todos",
              children: [
                { kind: "group", id: "deep", label: "深层", iconKey: "todos", children: [] },
              ],
            },
          ],
        },
      ] as unknown as Parameters<typeof defineNavigation>[0]),
    ).toThrow();

    expect(() =>
      defineNavigation([
        {
          id: "section",
          label: "区块",
          items: [
            {
              kind: "page",
              id: "unknown-icon",
              label: "未知图标",
              to: "/todos",
              iconKey: "missing",
            },
          ],
        },
      ] as unknown as Parameters<typeof defineNavigation>[0]),
    ).toThrow();
  });

  it("normalizes only organization roles", () => {
    expect(normalizeNavigationRole("owner")).toBe("owner");
    expect(normalizeNavigationRole("unknown")).toBeUndefined();
  });
});
