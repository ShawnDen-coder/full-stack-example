import { sql } from "drizzle-orm";
import type { Database } from "./client.js";

export const REQUIRED_DATABASE_MIGRATION_VERSION = 1_789_353_700_000;

const missingJournalErrorCodes = new Set(["3F000", "42P01", "42501"]);

export class DatabaseMigrationRequiredError extends Error {
  constructor(cause?: unknown) {
    super(
      "Database migrations are missing or out of date. Run `just infra-up` or `just provision` before starting the API.",
      cause === undefined ? {} : { cause },
    );
    this.name = "DatabaseMigrationRequiredError";
  }
}

export async function checkDatabase(db: Database): Promise<void> {
  await db.execute(sql`SELECT 1`);
}

export async function assertDatabaseMigrations(db: Database): Promise<void> {
  let rows: readonly { readonly createdAt?: unknown }[];
  try {
    rows = await db.execute(
      sql`SELECT created_at AS "createdAt" FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1`,
    );
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (typeof code === "string" && missingJournalErrorCodes.has(code))
      throw new DatabaseMigrationRequiredError(error);
    throw error;
  }

  const createdAt = rows[0]?.createdAt;
  const appliedVersion = createdAt === undefined ? Number.NaN : Number(createdAt);
  if (!Number.isFinite(appliedVersion) || appliedVersion < REQUIRED_DATABASE_MIGRATION_VERSION)
    throw new DatabaseMigrationRequiredError();
}
