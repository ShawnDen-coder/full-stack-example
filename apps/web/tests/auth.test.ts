// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { safeReturnTo } from "../src/auth.js";

describe("safeReturnTo", () => {
  it("accepts only local absolute paths", () => {
    expect(safeReturnTo("/todos?view=active")).toBe("/todos?view=active");
    expect(safeReturnTo("https://example.com")).toBe("/todos");
    expect(safeReturnTo("//example.com")).toBe("/todos");
    expect(safeReturnTo(null)).toBe("/todos");
  });
});
