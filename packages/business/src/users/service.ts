import type { Database } from "@my-better-t-app/db";
import { user } from "@my-better-t-app/db/schema/auth";
import { observeOperation } from "@my-better-t-app/observability";
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
