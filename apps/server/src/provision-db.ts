import { createDb } from "@full-stack-example/db";
import { provisionRuntimeRoles } from "@full-stack-example/db/provision";
import { createLogger } from "@full-stack-example/observability";

const logger = createLogger("provision-db");
const migration = process.env.MIGRATION_DATABASE_URL;
const server = process.env.DATABASE_URL;
const worker = process.env.WORKER_DATABASE_URL;
if (!migration || !server || !worker)
	throw new Error("Migration, server and worker database URLs are required");
const db = createDb(
	{ DATABASE_URL: migration },
	{ logger, role: "provision", max: 1 },
);
try {
	await provisionRuntimeRoles(db, { migration, server, worker });
	logger.info(
		{ event: "database.roles_configured" },
		"Runtime database roles configured",
	);
} catch {
	// Administrative SQL may contain password literals in PostgreSQL error context.
	logger.error(
		{ event: "database.roles_failed" },
		"Runtime database role provisioning failed",
	);
	process.exitCode = 1;
} finally {
	await db.close();
}
