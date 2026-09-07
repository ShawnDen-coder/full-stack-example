import { sql } from "drizzle-orm";
import type { Database } from "./client.js";

export async function checkDatabase(db: Database): Promise<void> {
  await db.execute(sql`SELECT 1`);
}
