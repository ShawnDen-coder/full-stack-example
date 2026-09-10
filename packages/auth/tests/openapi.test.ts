import { describe, expect, it } from "vitest";
import { normalizeAuthOpenApiDocument } from "../src/openapi.js";

describe("normalizeAuthOpenApiDocument", () => {
  it("keeps the product endpoints, prefixes them, and marks operations", () => {
    const document = normalizeAuthOpenApiDocument({
      components: {
        schemas: {
          Used: { type: "object" },
          Unused: { type: "object" },
        },
        securitySchemes: {
          apiKeyCookie: { type: "apiKey", in: "cookie" },
          bearerAuth: { type: "http", scheme: "bearer" },
        },
      },
      paths: {
        "/sign-up/email": { post: { operationId: "signUpEmail" } },
        "/sign-in/email": { post: { operationId: "signInEmail" } },
        "/sign-out": { post: { operationId: "signOut" } },
        "/organization/list": { get: { operationId: "listOrganizations" } },
        "/admin/list-users": { get: { operationId: "listUsers" } },
      },
    });

    expect(Object.keys(document.paths ?? {})).toEqual([
      "/api/auth/sign-up/email",
      "/api/auth/sign-in/email",
      "/api/auth/sign-out",
      "/api/auth/organization/list",
    ]);
    const signUp = document.paths?.["/api/auth/sign-up/email"] as {
      readonly post?: { readonly security?: unknown };
    };
    const signOut = document.paths?.["/api/auth/sign-out"] as {
      readonly post?: { readonly security?: unknown };
    };
    expect(signUp.post?.security).toEqual([]);
    expect(signOut.post?.security).toEqual([{ apiKeyCookie: [] }]);
    expect(document.components?.securitySchemes).toEqual({
      apiKeyCookie: { type: "apiKey", in: "cookie" },
    });
  });
});
