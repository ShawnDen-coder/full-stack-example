import { createDb } from "@full-stack-example/db";
import { createLogger } from "@full-stack-example/observability";
import { migrate } from "drizzle-orm/node-postgres/migrator";

export async function runMigrations(env: Record<string, string | undefined>) {
	const logger = createLogger("migrate");
	if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
	const timeout = Number(env.DB_MIGRATION_TIMEOUT_MS || 300000);
	const lockTimeout = Number(env.DB_MIGRATION_LOCK_TIMEOUT_MS || 5000);
	if (
		!Number.isInteger(timeout) ||
		timeout < 1 ||
		!Number.isInteger(lockTimeout) ||
		lockTimeout < 1
	)
		throw new Error("Invalid migration timeout");
	const db = createDb(
		{ DATABASE_URL: env.DATABASE_URL },
		{
			logger,
			role: "migrate",
			max: 1,
			statementTimeoutMillis: timeout,
			queryTimeoutMillis: timeout + 5000,
			lockTimeoutMillis: lockTimeout,
		},
	);
	try {
		await migrate(db, { migrationsFolder: "./migrations" });
		logger.info("Database migrations completed");
	} catch (err) {
		logger.error({ err }, "Database migration failed");
		throw new Error("Deployment operation failed");
	} finally {
		await db.close();
	}
}
