import { type AuthConfig, createAuth } from "@my-better-t-app/auth";
import { createDb } from "@my-better-t-app/db";
import { createLogger, type Logger } from "@my-better-t-app/logger";
import { createQueueClient } from "@my-better-t-app/queue";
import { createTodosService } from "@my-better-t-app/todos";
import { createUsersService } from "@my-better-t-app/users";

export type ServerConfig = {
	DATABASE_URL: string;
	REDIS_URL: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
	DB_POOL_MAX?: number;
	DB_QUERY_TIMEOUT_MS?: number;
};

export function createServices(
	config: ServerConfig,
	logger: Logger = createLogger("server"),
) {
	const db = createDb(config, {
		max: config.DB_POOL_MAX,
		queryTimeoutMillis: config.DB_QUERY_TIMEOUT_MS,
		logger,
	});
	let queueClient: ReturnType<typeof createQueueClient>;
	try {
		const authConfig: AuthConfig = {
			db,
			secret: config.BETTER_AUTH_SECRET,
			baseURL: config.BETTER_AUTH_URL,
			trustedOrigins: [config.CORS_ORIGIN],
		};
		const auth = createAuth(authConfig);
		queueClient = createQueueClient({ redisUrl: config.REDIS_URL, logger });
		const usersService = createUsersService({ deps: { db } });
		const todosService = createTodosService({ deps: { db } });
		let closePromise: Promise<void> | undefined;
		return {
			db,
			auth,
			logger,
			getSession: (headers: Headers) => auth.api.getSession({ headers }),
			services: { usersService, todosService, queueClient },
			async checkReady() {
				// Let both probes settle before cleanup can close an initializing client.
				const checks = await Promise.allSettled([
					db.$client.query("SELECT 1"),
					queueClient.checkReady(),
				]);
				for (const check of checks)
					if (check.status === "rejected") throw check.reason;
			},
			close() {
				closePromise ??= (async () => {
					try {
						await queueClient.close();
					} finally {
						await db.$client.end();
					}
				})();
				return closePromise;
			},
		};
	} catch (error) {
		void db.$client
			.end()
			.catch((err: unknown) => logger.error({ err }, "Startup cleanup failed"));
		throw error;
	}
}
