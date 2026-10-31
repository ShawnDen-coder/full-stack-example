import { createDb } from "@full-stack-example/db";
import { createTodosService } from "@full-stack-example/domain/todos";
import { createUsersService } from "@full-stack-example/domain/users";
import { createProfileReadClient } from "@full-stack-example/domain/users/jobs/profile-read/producer";
import { createAccessService } from "@full-stack-example/identity/access";
import {
	type Auth,
	type AuthConfig,
	createAuth,
} from "@full-stack-example/identity/auth";
import {
	createLogger,
	type Logger,
	withDeadline,
} from "@full-stack-example/observability";
import { createQueueMonitor } from "./queue-monitor";
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

export type ServerResources = {
	auth: Auth;
	logger: Logger;
	getSession(headers: Headers): ReturnType<Auth["api"]["getSession"]>;
	services: {
		usersService: ReturnType<typeof createUsersService>;
		todosService: ReturnType<typeof createTodosService>;
		profileJobs: Pick<
			ReturnType<typeof createProfileReadClient>,
			"enqueueProfileRead" | "getProfileReadJob"
		>;
		queueMonitor: ReturnType<typeof createQueueMonitor>;
		accessService: ReturnType<typeof createAccessService>;
	};
	checkReady(): Promise<void>;
	checkJobsReady(): Promise<void>;
	close(): Promise<void>;
};

export async function createServerResources(
	config: ServerConfig,
	logger: Logger = createLogger("server"),
	factories: Partial<typeof defaultFactories> = {},
): Promise<ServerResources> {
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
			auth,
			logger,
			getSession: (headers: Headers) => auth.api.getSession({ headers }),
			services: {
				usersService,
				todosService,
				profileJobs: {
					enqueueProfileRead: producer.enqueueProfileRead,
					getProfileReadJob: producer.getProfileReadJob,
				},
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
