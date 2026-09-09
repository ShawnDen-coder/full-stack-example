import { describe, expect, it } from "vitest";
import { createSessionPrincipal, createTenantPrincipal } from "../src/middleware.js";

describe("auth principals", () => {
  it("builds immutable session and tenant identity data", () => {
    const session = createSessionPrincipal({ userId: "u1", sessionId: "s1", platformRoles: ["user"] });
    const tenant = createTenantPrincipal({ session, tenantId: "t1", memberId: "m1", organizationRoles: ["member"], requestId: "r1" });
    expect(tenant).toMatchObject({ userId: "u1", sessionId: "s1", tenantId: "t1", memberId: "m1", requestId: "r1" });
  });
});
