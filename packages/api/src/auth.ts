import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@full-stack-example/db";
import * as schema from "@full-stack-example/db/schema/auth";
import { betterAuth } from "better-auth";

export type AuthConfig = {
	db: Database;
	secret: string;
	baseURL: string;
	trustedOrigins: string[];
};

export function createAuth({
	db,
	secret,
	baseURL,
	trustedOrigins,
}: AuthConfig) {
	return betterAuth({
		database: drizzleAdapter(db, { provider: "pg", schema }),
		secret,
		baseURL,
		trustedOrigins,
		emailAndPassword: { enabled: true },
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
