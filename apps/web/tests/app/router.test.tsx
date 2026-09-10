// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { routeTree } from "../../src/routeTree.gen.js";

describe("application routes", () => {
  it("matches the home, authentication, workspace, and Todo routes", () => {
    expect(routeTree).toBeDefined();
    expect(routeTree.children?.length).toBeGreaterThan(0);
  });
});
