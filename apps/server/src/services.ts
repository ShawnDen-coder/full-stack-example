import { type AuthConfig, createAuth } from "@my-better-t-app/auth";
import { createDb } from "@my-better-t-app/db";
import { createQueueClient } from "@my-better-t-app/queue";
import { createUsersService } from "@my-better-t-app/users";

export type ServerConfig = {
	DATABASE_URL: string;
	REDIS_URL: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
};

export function createServices(config: ServerConfig) {
	const db = createDb(config);
	const authConfig: AuthConfig = {
		db,
		secret: config.BETTER_AUTH_SECRET,
		baseURL: config.BETTER_AUTH_URL,
		trustedOrigins: [config.CORS_ORIGIN],
	};
	const auth = createAuth(authConfig);
	const queueClient = createQueueClient({ redisUrl: config.REDIS_URL });
	const usersService = createUsersService({ deps: { db } });
	return {
		db,
		auth,
		getSession: (headers: Headers) => auth.api.getSession({ headers }),
		services: { usersService, queueClient },
		async close() {
			try {
				await queueClient.close();
			} finally {
				await db.$client.end();
			}
		},
	};
}
