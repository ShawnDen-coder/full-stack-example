import type { Database } from "@full-stack-example/db";
import { user } from "@full-stack-example/db/schema/auth";
import { observeOperation } from "@full-stack-example/observability";
import { eq } from "drizzle-orm";

export function createUsersService({ db }: { db: Database }) {
	return {
		async getProfile(userId: string) {
			const [profile] = await observeOperation("users.getProfile", async () =>
				db
					.select({
						id: user.id,
						name: user.name,
						email: user.email,
						emailVerified: user.emailVerified,
						image: user.image,
						createdAt: user.createdAt,
					})
					.from(user)
					.where(eq(user.id, userId))
					.limit(1),
			);
			return profile ?? null;
		},
	};
}

export type UsersService = ReturnType<typeof createUsersService>;
