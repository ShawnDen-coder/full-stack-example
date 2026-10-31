import { createDb } from "@full-stack-example/db";
import { createAuth } from "@full-stack-example/identity/auth";

export { runMigrations } from "./migrate";
export { provisionDatabase } from "./provision-db";

// The schema generator owns this dedicated, non-runtime database instance.
export function createAuthSchema(config: {
	DATABASE_URL: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
}) {
	return createAuth({
		db: createDb(config),
		secret: config.BETTER_AUTH_SECRET,
		baseURL: config.BETTER_AUTH_URL,
		trustedOrigins: [config.CORS_ORIGIN],
	});
}
