import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  createDatabase,
  organization,
  tenantNotes,
  todos,
  withTenantTransaction,
} from "../src/index.js";

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

  it("prevents app_runtime from reading another tenant", async () => {
    const database = createDatabase({ databaseUrl: process.env.DATABASE_URL as string });
    const tenantA = `rls-a-${Date.now()}`;
    const tenantB = `rls-b-${Date.now()}`;
    try {
      await database.db.insert(organization).values([
        { id: tenantA, name: tenantA, slug: tenantA, createdAt: new Date() },
        { id: tenantB, name: tenantB, slug: tenantB, createdAt: new Date() },
      ]);
      await database.db.insert(tenantNotes).values([
        { tenantId: tenantA, body: "a" },
        { tenantId: tenantB, body: "b" },
      ]);
      await database.db.insert(todos).values([
        { title: "a", tenantId: tenantA },
        { title: "b", tenantId: tenantB },
      ]);
      const rows = await withTenantTransaction(database.db, tenantA, async (tx) => {
        await tx.execute(sql`set local role app_runtime`);
        return tx.select().from(tenantNotes);
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.tenantId).toBe(tenantA);
      const todoRows = await withTenantTransaction(database.db, tenantA, async (tx) => {
        await tx.execute(sql`set local role app_runtime`);
        return tx.select().from(todos);
      });
      expect(todoRows).toHaveLength(1);
      expect(todoRows[0]?.tenantId).toBe(tenantA);
    } finally {
      await database.db.delete(todos).where(eq(todos.tenantId, tenantA));
      await database.db.delete(todos).where(eq(todos.tenantId, tenantB));
      await database.db.delete(tenantNotes).where(eq(tenantNotes.tenantId, tenantA));
      await database.db.delete(tenantNotes).where(eq(tenantNotes.tenantId, tenantB));
      await database.db.delete(organization).where(eq(organization.id, tenantA));
      await database.db.delete(organization).where(eq(organization.id, tenantB));
      await database.close();
    }
  });

  it("does not leak tenant context between pooled transactions", async () => {
    const database = createDatabase({ databaseUrl: process.env.DATABASE_URL as string });
    try {
      const first = await withTenantTransaction(database.db, "tenant-a", async (tx) =>
        tx.execute(sql`select current_setting('app.tenant_id', true) as value`),
      );
      const second = await withTenantTransaction(database.db, "tenant-b", async (tx) =>
        tx.execute(sql`select current_setting('app.tenant_id', true) as value`),
      );
      expect((first as any)[0].value).toBe("tenant-a");
      expect((second as any)[0].value).toBe("tenant-b");
    } finally {
      await database.close();
    }
  });
});
