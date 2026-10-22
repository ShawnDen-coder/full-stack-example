import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@my-better-t-app/db";
import * as schema from "@my-better-t-app/db/schema/auth";
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
