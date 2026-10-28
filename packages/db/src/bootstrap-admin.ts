import "varlock/auto-load";
import { and, eq, sql } from "drizzle-orm";
import { createDb } from "./index";
import { member, session, user } from "./schema";

const userId = process.argv[2];
if (!userId || !process.env.DATABASE_URL)
	throw new Error(
		"Usage: pnpm admin:bootstrap <existing-user-id> with deployment DATABASE_URL",
	);
const db = createDb({ DATABASE_URL: process.env.DATABASE_URL });
try {
	await db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(731902481)`);
		const existing = await tx
			.select({ id: user.id })
			.from(user)
			.where(eq(user.role, "superadmin"));
		if (existing.length)
			throw new Error(
				"A super administrator already exists. Use the administration screen.",
			);
		const [target] = await tx.select().from(user).where(eq(user.id, userId));
		if (!target || target.banned)
			throw new Error("An existing active account is required");
		await tx
			.update(user)
			.set({ role: "superadmin" })
			.where(eq(user.id, userId));
		await tx.delete(session).where(eq(session.userId, userId));
		const membership = await tx
			.update(member)
			.set({ role: "owner" })
			.where(
				and(
					eq(member.userId, userId),
					eq(member.organizationId, "application"),
				),
			)
			.returning({ id: member.id });
		if (membership.length !== 1)
			throw new Error("An existing workspace membership is required");
	});
	console.log("Super administrator initialized. Sign in again.");
} finally {
	await db.close();
}
