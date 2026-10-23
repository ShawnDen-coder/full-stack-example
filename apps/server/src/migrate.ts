import { createDb } from "@my-better-t-app/db";
import { createLogger } from "@my-better-t-app/logger";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const logger = createLogger("migrate");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = createDb({ DATABASE_URL: process.env.DATABASE_URL }, { logger });
try {
	await migrate(db, { migrationsFolder: "./migrations" });
	logger.info("Database migrations completed");
} catch (err) {
	logger.error({ err }, "Database migration failed");
	process.exitCode = 1;
} finally {
	await db.$client.end();
}
