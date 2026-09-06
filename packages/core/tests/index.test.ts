import { describe, expect, it } from "vitest";

describe("core", () => {
  it("loads its public entry point", async () => {
    const module = await import("../src/index.js");
    expect(Object.keys(module)).toEqual([]);
  });
});
