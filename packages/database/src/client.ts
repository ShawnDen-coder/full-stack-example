import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type Database = PostgresJsDatabase<Record<string, never>>;

export interface DatabaseContext {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

export function createDatabase(options: { readonly databaseUrl: string }): DatabaseContext {
  const client = postgres(options.databaseUrl, { max: 10 });
  return { db: drizzle(client), close: () => client.end({ timeout: 5 }) };
}
