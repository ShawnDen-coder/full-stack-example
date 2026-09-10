// @vitest-environment jsdom

import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import { routes } from "../../src/app/router.js";

describe("application routes", () => {
  it("matches the home, authentication, workspace, and Todo routes", () => {
    expect(matchRoutes(routes, "/")?.at(-1)?.route.path).toBe("/");
    expect(matchRoutes(routes, "/login")?.at(-1)?.route.path).toBe("/login");
    expect(matchRoutes(routes, "/register")?.at(-1)?.route.path).toBe("/register");
    expect(matchRoutes(routes, "/workspaces")?.at(-1)?.route.path).toBe("/workspaces");
    expect(matchRoutes(routes, "/todos")?.at(-1)?.route.path).toBe("/todos");
  });
});
