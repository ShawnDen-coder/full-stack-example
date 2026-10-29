// Test-only membership provisioning. Never mounted in the application.
import { randomUUID } from "node:crypto";
import { createDb } from "@full-stack-example/db";
import { member } from "@full-stack-example/db/schema";

const ids = process.argv.slice(2);
if (
	!process.env.TEST_DATABASE_URL ||
	!ids.length ||
	ids.some((id) => !id || id.length > 128)
)
	throw new Error("Dedicated test database and explicit users required");
const db = createDb({ DATABASE_URL: process.env.TEST_DATABASE_URL });
try {
	await db
		.insert(member)
		.values(
			ids.map((userId) => ({
				id: randomUUID(),
				userId,
				organizationId: "application",
				role: "member,standard",
				createdAt: new Date(),
			})),
		)
		.onConflictDoNothing({ target: [member.organizationId, member.userId] });
} finally {
	await db.close();
}
