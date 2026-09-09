import { describe, expect, it } from "vitest";
import { account, createDatabase, invitation, member, organization, session, user } from "@full-stack-example/database";
import { eq } from "drizzle-orm";
import { createAuthModule } from "../src/server.js";

describe.skipIf(!process.env.DATABASE_URL)("Better Auth PostgreSQL integration", () => {
  it("provisions a user and organization on behalf of the owner", async () => {
    const database = createDatabase({ databaseUrl: process.env.DATABASE_URL as string });
    const suffix = Date.now().toString();
    const email = `owner-${suffix}@example.test`;
    const slug = `org-${suffix}`;
    const auth = createAuthModule({ database: database.db, baseURL: "http://localhost:3000", secret: "test-secret-that-is-at-least-32-characters-long", trustedOrigins: ["http://localhost:5173"] });
    let userId: string | undefined;
    let organizationId: string | undefined;
    try {
      const created = await auth.platform.createUser({ email, name: "Owner" });
      userId = created.id;
      const createdOrganization = await auth.platform.createOrganization({ name: "Test Org", slug, ownerUserId: userId });
      organizationId = createdOrganization.id;
      const [owner] = await database.db.select().from(member).where(eq(member.organizationId, organizationId));
      expect(owner?.userId).toBe(userId);
    } finally {
      if (organizationId) {
        await database.db.delete(invitation).where(eq(invitation.organizationId, organizationId));
        await database.db.delete(member).where(eq(member.organizationId, organizationId));
        await database.db.delete(organization).where(eq(organization.id, organizationId));
      }
      if (userId) {
        await database.db.delete(session).where(eq(session.userId, userId));
        await database.db.delete(account).where(eq(account.userId, userId));
        await database.db.delete(user).where(eq(user.id, userId));
      }
      await database.close();
    }
  });
});
