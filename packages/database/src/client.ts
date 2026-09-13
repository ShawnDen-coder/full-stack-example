import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseContext {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

export function createDatabase(options: {
  readonly databaseUrl: string;
  readonly poolMax?: number;
}): DatabaseContext {
  const poolMax = options.poolMax ?? 10;
  if (!Number.isSafeInteger(poolMax) || poolMax < 1)
    throw new Error("poolMax must be a positive integer");
  const client = postgres(options.databaseUrl, { max: poolMax });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
