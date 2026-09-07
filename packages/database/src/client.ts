import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseContext {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

export function createDatabase(options: { readonly databaseUrl: string }): DatabaseContext {
  const client = postgres(options.databaseUrl, { max: 10 });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
