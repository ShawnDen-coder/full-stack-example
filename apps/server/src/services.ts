import { type AuthConfig, createAuth } from "@full-stack-example/api/auth";
import { createDb } from "@full-stack-example/db";
import { createTodosService } from "@full-stack-example/domain/todos";
import { createUsersService } from "@full-stack-example/domain/users";
import { createProfileReadClient } from "@full-stack-example/domain/users/jobs/profile-read/producer";
import { createLogger, type Logger } from "@full-stack-example/observability";

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
		role: "server",
	});
	let profileJobs: ReturnType<typeof createProfileReadClient>;
	try {
		const authConfig: AuthConfig = {
			db,
			secret: config.BETTER_AUTH_SECRET,
			baseURL: config.BETTER_AUTH_URL,
			trustedOrigins: [config.CORS_ORIGIN],
		};
		const auth = createAuth(authConfig);
		profileJobs = createProfileReadClient({
			redisUrl: config.REDIS_URL,
			logger,
		});
		const usersService = createUsersService({ db });
		const todosService = createTodosService({ db });
		let closePromise: Promise<void> | undefined;
		return {
			db,
			auth,
			logger,
			getSession: (headers: Headers) => auth.api.getSession({ headers }),
			services: { usersService, todosService, profileJobs },
			async checkReady() {
				await db.$client.query("SELECT 1");
			},
			checkJobsReady: () => profileJobs.checkReady(),
			close() {
				closePromise ??= (async () => {
					try {
						await profileJobs.close();
					} finally {
						await db.close();
					}
				})();
				return closePromise;
			},
		};
	} catch (error) {
		void db
			.close()
			.catch((err: unknown) => logger.error({ err }, "Startup cleanup failed"));
		throw error;
	}
}
