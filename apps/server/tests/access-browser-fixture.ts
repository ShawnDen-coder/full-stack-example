// Test-only cleanup invoked by browser tests; never mounted as an HTTP endpoint.
import { createDb } from "@full-stack-example/db";
import { organizationRole, user } from "@full-stack-example/db/schema";
import { eq, inArray } from "drizzle-orm";

const ids = process.argv.slice(2);
if (
	!process.env.TEST_DATABASE_URL ||
	!ids.length ||
	ids.some((id) => !id || id.length > 128)
)
	throw new Error(
		"Dedicated TEST_DATABASE_URL and explicit account IDs required",
	);
const db = createDb({ DATABASE_URL: process.env.TEST_DATABASE_URL });
try {
	await db.delete(user).where(inArray(user.id, ids));
	await db
		.delete(organizationRole)
		.where(eq(organizationRole.role, "browser-limited"));
} finally {
	await db.close();
}
