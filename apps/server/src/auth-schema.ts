// Better Auth CLI entry: importing this file never starts queues, workers, or HTTP.
import { createAuth } from "@full-stack-example/api/auth";
import { createDb } from "@full-stack-example/db";
import { ENV } from "./env.server";

export const auth = createAuth({
	db: createDb(ENV),
	secret: ENV.BETTER_AUTH_SECRET,
	baseURL: ENV.BETTER_AUTH_URL,
	trustedOrigins: [ENV.CORS_ORIGIN],
});
