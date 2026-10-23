import type { Logger } from "@my-better-t-app/logger";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { DatabaseConfig } from "./config";
import { relations } from "./relations";

export function createDb(
	env: DatabaseConfig,
	options: {
		connectionTimeoutMillis?: number;
		queryTimeoutMillis?: number;
		max?: number;
		logger?: Logger;
	} = {},
) {
	const pool = new Pool({
		connectionString: env.DATABASE_URL,
		connectionTimeoutMillis: options.connectionTimeoutMillis ?? 10000,
		query_timeout: options.queryTimeoutMillis ?? 10000,
		statement_timeout: options.queryTimeoutMillis ?? 10000,
		max: options.max ?? 10,
	});
	pool.on("error", (err) =>
		options.logger?.error({ err }, "Database pool connection failed"),
	);
	return drizzle({ client: pool, relations });
}

export type Database = ReturnType<typeof createDb>;
