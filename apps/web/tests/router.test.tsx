// @vitest-environment jsdom

import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import { routes } from "../src/app/router.js";

describe("application routes", () => {
  it("matches the home and Todo routes", () => {
    expect(matchRoutes(routes, "/")?.at(-1)?.route.path).toBe("/");
    expect(matchRoutes(routes, "/todos")?.at(-1)?.route.path).toBe("/todos");
  });
});
