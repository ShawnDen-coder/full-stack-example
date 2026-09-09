import { sql } from "drizzle-orm";
import type { Database } from "./client.js";

export type TenantTransaction = Parameters<Database["transaction"]>[0] extends (
  tx: infer T,
) => unknown
  ? T
  : never;

export async function withTenantTransaction<T>(
  database: Database,
  tenantId: string,
  work: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  if (!tenantId) throw new Error("tenantId is required");
  return database.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return work(tx as TenantTransaction);
  });
}
