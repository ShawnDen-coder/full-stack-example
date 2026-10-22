// Better Auth CLI entry: importing this file never starts queues, workers, or HTTP.
import { createAuth } from "@my-better-t-app/auth";
import { createDb } from "@my-better-t-app/db";
import { ENV } from "./env.server";

export const auth = createAuth({
	db: createDb(ENV),
	secret: ENV.BETTER_AUTH_SECRET,
	baseURL: ENV.BETTER_AUTH_URL,
	trustedOrigins: [ENV.CORS_ORIGIN],
});
