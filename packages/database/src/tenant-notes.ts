import { desc, eq } from "drizzle-orm";
import { tenantNotes } from "./schema/tenant-notes.js";
import type { TenantTransaction } from "./tenant.js";

export function createTenantNotesRepository(tx: TenantTransaction) {
  return {
    list: () => tx.select().from(tenantNotes).orderBy(desc(tenantNotes.id)),
    remove: (id: number) => tx.delete(tenantNotes).where(eq(tenantNotes.id, id)),
  };
}
