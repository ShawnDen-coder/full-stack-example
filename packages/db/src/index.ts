import { type Logger, observePool } from "@my-better-t-app/observability";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { DatabaseConfig } from "./config";
import { relations } from "./relations";

export function createDb(
	env: DatabaseConfig,
	options: {
		connectionTimeoutMillis?: number;
		queryTimeoutMillis?: number;
		statementTimeoutMillis?: number;
		lockTimeoutMillis?: number;
		role?: string;
		max?: number;
		logger?: Logger;
	} = {},
) {
	const pool = new Pool({
		connectionString: env.DATABASE_URL,
		connectionTimeoutMillis: options.connectionTimeoutMillis ?? 10000,
		query_timeout: options.queryTimeoutMillis ?? 10000,
		statement_timeout:
			options.statementTimeoutMillis ?? options.queryTimeoutMillis ?? 10000,
		lock_timeout: options.lockTimeoutMillis ?? 5000,
		idle_in_transaction_session_timeout: 30000,
		application_name: options.role ?? "application",
		max: options.max ?? 10,
	});
	pool.on("error", (err) =>
		options.logger?.error({ err }, "Database pool connection failed"),
	);
	const stopMetrics = observePool(pool, options.role ?? "application");
	const db = drizzle({ client: pool, relations });
	let closing: Promise<void> | undefined;
	return Object.assign(db, {
		close() {
			closing ??= (async () => {
				stopMetrics();
				await pool.end();
			})();
			return closing;
		},
	});
}

export type Database = ReturnType<typeof createDb>;
