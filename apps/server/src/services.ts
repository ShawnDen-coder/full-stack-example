import { createAccessService } from "@full-stack-example/api/access";
import { type AuthConfig, createAuth } from "@full-stack-example/api/auth";
import { createQueueMonitor } from "@full-stack-example/api/queue-monitor";
import { createDb } from "@full-stack-example/db";
import { createTodosService } from "@full-stack-example/domain/todos";
import { createUsersService } from "@full-stack-example/domain/users";
import { createProfileReadClient } from "@full-stack-example/domain/users/jobs/profile-read/producer";
import {
	createLogger,
	type Logger,
	withDeadline,
} from "@full-stack-example/observability";
import {
	summarizeProfileJobData,
	summarizeProfileJobResult,
} from "./queue-summaries";

export type ServerConfig = {
	DATABASE_URL: string;
	REDIS_URL: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
	DB_POOL_MAX?: number;
	DB_QUERY_TIMEOUT_MS?: number;
	SERVER_SHUTDOWN_TIMEOUT_MS?: number;
};

const defaultFactories = {
	createDb,
	createAuth,
	createProfileReadClient,
	createUsersService,
	createTodosService,
	createQueueMonitor,
	createAccessService,
};

export async function createServices(
	config: ServerConfig,
	logger: Logger = createLogger("server"),
	factories: Partial<typeof defaultFactories> = {},
) {
	const factory = { ...defaultFactories, ...factories };
	const db = factory.createDb(config, {
		max: config.DB_POOL_MAX,
		queryTimeoutMillis: config.DB_QUERY_TIMEOUT_MS,
		logger,
		role: "server",
	});
	let profileJobs: ReturnType<typeof createProfileReadClient> | undefined;
	try {
		const authConfig: AuthConfig = {
			db,
			secret: config.BETTER_AUTH_SECRET,
			baseURL: config.BETTER_AUTH_URL,
			trustedOrigins: [config.CORS_ORIGIN],
		};
		const auth = factory.createAuth(authConfig);
		profileJobs = factory.createProfileReadClient({
			redisUrl: config.REDIS_URL,
			logger,
		});
		const usersService = factory.createUsersService({ db });
		const todosService = factory.createTodosService({ db });
		const queueMonitor = factory.createQueueMonitor([
			{
				key: "user-profile",
				name: "User profile",
				queue: profileJobs.getQueueForMonitoring(),
				summarizeData: summarizeProfileJobData,
				summarizeResult: summarizeProfileJobResult,
			},
		]);
		const producer = profileJobs;
		let closePromise: Promise<void> | undefined;
		return {
			db,
			auth,
			logger,
			getSession: (headers: Headers) => auth.api.getSession({ headers }),
			services: {
				usersService,
				todosService,
				profileJobs,
				queueMonitor,
				accessService: factory.createAccessService(auth, db),
			},
			async checkReady() {
				await db.$client.query("SELECT 1");
			},
			checkJobsReady: () => producer.checkReady(),
			close() {
				closePromise ??= (async () => {
					try {
						await producer.close();
					} finally {
						await db.close();
					}
				})();
				return closePromise;
			},
		};
	} catch (error) {
		const report = (err: unknown, resource?: string) => {
			try {
				logger.error({ err, resource }, "Startup cleanup failed");
			} catch {
				// A broken logger must not replace the assembly failure.
			}
		};
		// Start both cleanups even if one hangs or throws synchronously.
		const resources = [
			...(profileJobs
				? [{ name: "producer", close: () => profileJobs?.close() }]
				: []),
			{ name: "database", close: () => db.close() },
		];
		const cleanup = Promise.all(
			resources.map(async ({ name, close }) => {
				try {
					await Promise.resolve().then(close);
				} catch (err) {
					report(err, name);
				}
			}),
		);
		try {
			await withDeadline(
				cleanup,
				config.SERVER_SHUTDOWN_TIMEOUT_MS ?? 30000,
				"Startup cleanup timed out",
			);
		} catch (err) {
			report(err);
		}
		throw error;
	}
}
