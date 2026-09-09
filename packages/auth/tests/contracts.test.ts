import { describe, expect, it } from "vitest";
import { createPermissionPolicy } from "../src/permissions.js";

describe("auth module contracts", () => {
  it("creates the three fixed organization roles", () => {
    const policy = createPermissionPolicy({
      roles: { member: { project: ["read"] } },
    });

    expect(Object.keys(policy.roles)).toEqual(["owner", "admin", "member"]);
    expect(policy.roles.member.project).toEqual(["read"]);
  });
});
