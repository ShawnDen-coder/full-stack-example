import { createDb } from "@my-better-t-app/db";
import { createUsersService, type UsersService } from "@my-better-t-app/users";
import { createUserProfileWorker } from "@my-better-t-app/users/workers/user-profile.worker";

export type WorkerConfig = {
	DATABASE_URL: string;
	REDIS_URL: string;
	WORKER_CONCURRENCY: number;
	WORKER_STARTUP_TIMEOUT_MS: number;
};

type WorkerResources = {
	usersService: UsersService;
	checkReady(): Promise<void>;
	close(): Promise<void>;
};

type ProfileWorker = {
	waitUntilReady(): Promise<unknown>;
	run(): Promise<void>;
	close(force?: boolean): Promise<void>;
};

// Concrete factory boundaries make startup/rollback testable without live services.
export type WorkerFactories = {
	createResources(config: WorkerConfig): WorkerResources;
	createWorker(options: {
		redisUrl: string;
		usersService: UsersService;
		concurrency: number;
		autorun: false;
	}): ProfileWorker;
};

const factories: WorkerFactories = {
	createResources(config) {
		const db = createDb(config, {
			connectionTimeoutMillis: config.WORKER_STARTUP_TIMEOUT_MS,
			queryTimeoutMillis: config.WORKER_STARTUP_TIMEOUT_MS,
		});
		return {
			usersService: createUsersService({ deps: { db } }),
			async checkReady() {
				await db.$client.query("SELECT 1");
			},
			close: () => db.$client.end(),
		};
	},
	createWorker: createUserProfileWorker,
};

async function waitForReady(check: Promise<unknown>, timeoutMs: number) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			check,
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error("Worker startup timed out")),
					timeoutMs,
				);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}

export async function startWorker(
	config: WorkerConfig,
	deps: WorkerFactories = factories,
) {
	if (
		!Number.isInteger(config.WORKER_CONCURRENCY) ||
		config.WORKER_CONCURRENCY < 1 ||
		config.WORKER_CONCURRENCY > 100 ||
		!Number.isInteger(config.WORKER_STARTUP_TIMEOUT_MS) ||
		config.WORKER_STARTUP_TIMEOUT_MS < 1
	) {
		throw new Error("Invalid worker concurrency or startup timeout");
	}
	const resources = deps.createResources(config);
	let worker: ProfileWorker | undefined;
	try {
		await waitForReady(
			resources.checkReady(),
			config.WORKER_STARTUP_TIMEOUT_MS,
		);
		worker = deps.createWorker({
			redisUrl: config.REDIS_URL,
			usersService: resources.usersService,
			concurrency: config.WORKER_CONCURRENCY,
			autorun: false,
		});
		await waitForReady(
			worker.waitUntilReady(),
			config.WORKER_STARTUP_TIMEOUT_MS,
		);
		const done = worker.run();
		// The process entry observes failure; attach a handler before returning it.
		void done.catch(() => {});
		const runningWorker = worker;
		let closePromise: Promise<void> | undefined;
		return {
			done,
			close() {
				closePromise ??= (async () => {
					try {
						await runningWorker.close();
					} finally {
						await resources.close();
					}
				})();
				return closePromise;
			},
		};
	} catch (error) {
		const errors: unknown[] = [error];
		try {
			await worker?.close(true);
		} catch (cleanupError) {
			errors.push(cleanupError);
		}
		try {
			await resources.close();
		} catch (cleanupError) {
			errors.push(cleanupError);
		}
		if (errors.length > 1)
			throw new AggregateError(errors, "Worker startup and cleanup failed");
		throw error;
	}
}
