import { sql } from "drizzle-orm";
import type { Database } from "./client.js";

export async function checkDatabase(db: Database): Promise<void> {
  await db.execute(sql`SELECT 1`);
}

export async function assertDatabaseMigrations(db: Database): Promise<void> {
  try {
    await db.execute(sql`SELECT id FROM "user" LIMIT 0`);
    await db.execute(sql`SELECT id FROM todos LIMIT 0`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "42P01")
      throw new Error(
        "Database schema is not initialized. Run `just infra-up` before starting the API.",
        {
          cause: error,
        },
      );
    throw error;
  }
}
