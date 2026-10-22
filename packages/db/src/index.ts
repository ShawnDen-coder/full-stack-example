import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { DatabaseConfig } from "./config";
import { relations } from "./relations";

export function createDb(
	env: DatabaseConfig,
	options: {
		connectionTimeoutMillis?: number;
		queryTimeoutMillis?: number;
	} = {},
) {
	const pool = new Pool({
		connectionString: env.DATABASE_URL,
		connectionTimeoutMillis: options.connectionTimeoutMillis ?? 10000,
		query_timeout: options.queryTimeoutMillis,
	});
	return drizzle({ client: pool, relations });
}

export type Database = ReturnType<typeof createDb>;
