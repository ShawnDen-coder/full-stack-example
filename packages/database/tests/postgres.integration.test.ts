import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDatabase, withTenantTransaction } from "../src/index.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("PostgreSQL tenant isolation", () => {
  it("keeps tenant context transaction-local", async () => {
    const database = createDatabase({ databaseUrl: process.env.DATABASE_URL as string });
    try {
      const result = await withTenantTransaction(database.db, "tenant-a", async (tx) => {
        const row = await tx.execute(
          sql`select current_setting('app.tenant_id', true) as tenant_id`,
        );
        return (row as any)[0]?.tenant_id;
      });
      expect(result).toBe("tenant-a");
    } finally {
      await database.close();
    }
  });
});
