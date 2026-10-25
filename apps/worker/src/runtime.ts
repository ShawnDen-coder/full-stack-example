import {
	createUsersService,
	type UsersService,
} from "@full-stack-example/business/users";
import { USER_PROFILE_QUEUE } from "@full-stack-example/business/users/jobs/profile-read/contract";
import { createProfileReadWorker } from "@full-stack-example/business/users/jobs/profile-read/worker";
import { createDb } from "@full-stack-example/db";
import {
	createLogger,
	type Logger,
	withDeadline,
} from "@full-stack-example/observability";

export type WorkerConfig = {
	DATABASE_URL: string;
	DB_POOL_MAX?: number;
	DB_QUERY_TIMEOUT_MS?: number;
	REDIS_URL: string;
	WORKER_CONCURRENCY: number;
	WORKER_STARTUP_TIMEOUT_MS: number;
	WORKER_SHUTDOWN_TIMEOUT_MS: number;
};

type WorkerServices = { usersService: UsersService };
type WorkerResources = {
	services: WorkerServices;
	checkReady(): Promise<void>;
	close(): Promise<void>;
};

// Native BullMQ Workers satisfy this application-owned lifecycle protocol.
export type Consumer = {
	waitUntilReady(): Promise<unknown>;
	run(): Promise<void>;
	isRunning(): boolean;
	readonly client: Promise<{
		status: string;
		get(key: string): Promise<string | null>;
	}>;
	close(force?: boolean): Promise<void>;
};

export type ConsumerDefinition = {
	name: string;
	concurrency?: number;
	create(options: {
		redisUrl: string;
		services: WorkerServices;
		concurrency: number;
		logger: Logger;
	}): Consumer;
};

// Register business consumers here. Readiness, failure and drain need no per-job wiring.
const consumerDefinitions = [
	{
		name: USER_PROFILE_QUEUE,
		create: ({ redisUrl, services, concurrency, logger }) =>
			createProfileReadWorker({
				redisUrl,
				usersService: services.usersService,
				concurrency,
				logger,
			}),
	},
] satisfies readonly ConsumerDefinition[];

export type WorkerFactories = {
	createResources(config: WorkerConfig, logger: Logger): WorkerResources;
	consumerDefinitions: readonly ConsumerDefinition[];
};

const defaultFactories: WorkerFactories = {
	createResources(config, logger) {
		const db = createDb(config, {
			connectionTimeoutMillis: config.WORKER_STARTUP_TIMEOUT_MS,
			queryTimeoutMillis: config.DB_QUERY_TIMEOUT_MS,
			max: config.DB_POOL_MAX,
			role: "worker",
			logger,
		});
		return {
			services: { usersService: createUsersService({ db }) },
			async checkReady() {
				await db.$client.query("SELECT 1");
			},
			close: () => db.close(),
		};
	},
	consumerDefinitions,
};

export class WorkerStartupAbortedError extends Error {
	constructor(cause?: unknown) {
		super("Worker startup cancelled", { cause });
		this.name = "WorkerStartupAbortedError";
	}
}

function checkCancelled(signal?: AbortSignal) {
	if (signal?.aborted) throw new WorkerStartupAbortedError(signal.reason);
}

async function waitForStartup<T>(
	work: Promise<T>,
	timeout: number,
	signal?: AbortSignal,
) {
	let abort: (() => void) | undefined;
	try {
		return await withDeadline(
			Promise.race([
				work,
				new Promise<never>((_, reject) => {
					abort = () => reject(new WorkerStartupAbortedError(signal?.reason));
					signal?.addEventListener("abort", abort, { once: true });
					if (signal?.aborted) abort();
				}),
			]),
			timeout,
			"Worker startup timed out",
		);
	} finally {
		if (abort) signal?.removeEventListener("abort", abort);
	}
}

function validUrl(value: string, protocols: string[]) {
	try {
		const url = new URL(value);
		return protocols.includes(url.protocol) && Boolean(url.hostname);
	} catch {
		return false;
	}
}

function validate(
	config: WorkerConfig,
	definitions: readonly ConsumerDefinition[],
) {
	const positiveInteger = (value: number) =>
		Number.isInteger(value) && value > 0;
	const concurrency = (value: number) => positiveInteger(value) && value <= 100;
	if (
		!concurrency(config.WORKER_CONCURRENCY) ||
		!positiveInteger(config.WORKER_STARTUP_TIMEOUT_MS) ||
		!positiveInteger(config.WORKER_SHUTDOWN_TIMEOUT_MS) ||
		(config.DB_POOL_MAX !== undefined && !concurrency(config.DB_POOL_MAX)) ||
		(config.DB_QUERY_TIMEOUT_MS !== undefined &&
			!positiveInteger(config.DB_QUERY_TIMEOUT_MS)) ||
		!validUrl(config.DATABASE_URL, ["postgres:", "postgresql:"]) ||
		!validUrl(config.REDIS_URL, ["redis:", "rediss:"])
	)
		throw new Error("Invalid worker configuration");
	const names = new Set<string>();
	if (!definitions.length)
		throw new Error("Consumer registry must not be empty");
	for (const definition of definitions) {
		if (
			!/^[a-z][a-z0-9-]*$/.test(definition.name) ||
			names.has(definition.name)
		)
			throw new Error("Consumer names must be stable and unique");
		if (!concurrency(definition.concurrency ?? config.WORKER_CONCURRENCY))
			throw new Error(`Invalid concurrency for consumer ${definition.name}`);
		names.add(definition.name);
	}
}

function consumerError(name: string, phase: string, cause: unknown) {
	return new Error(`Consumer ${name} ${phase}`, { cause });
}

// Invoke every cleanup, including when a factory's close throws synchronously.
function attempt(work: () => Promise<unknown>) {
	return Promise.resolve().then(work);
}
function rejected(results: PromiseSettledResult<unknown>[]) {
	return results.flatMap((result) =>
		result.status === "rejected" ? [result.reason] : [],
	);
}

export async function startWorker({
	config,
	factories = defaultFactories,
	logger = createLogger("worker"),
	signal,
}: {
	config: WorkerConfig;
	factories?: WorkerFactories;
	logger?: Logger;
	signal?: AbortSignal;
}) {
	validate(config, factories.consumerDefinitions);
	checkCancelled(signal);
	const resources = factories.createResources(config, logger);
	const consumers: { name: string; worker: Consumer }[] = [];
	const loops: Promise<void>[] = [];
	const loopErrors: Error[] = [];
	let state: "starting" | "running" | "closing" | "closed" | "failed" =
		"starting";
	const completion = Promise.withResolvers<void>();
	// Subscribe now: failures may precede the process entry's subscription.
	void completion.promise.catch(() => {});
	const recordFailure = (error: Error) => {
		loopErrors.push(error);
		if (state !== "closing" && state !== "closed") state = "failed";
		completion.reject(error);
	};
	try {
		await waitForStartup(
			resources.checkReady(),
			config.WORKER_STARTUP_TIMEOUT_MS,
			signal,
		);
		checkCancelled(signal);
		for (const definition of factories.consumerDefinitions) {
			checkCancelled(signal);
			const worker = definition.create({
				redisUrl: config.REDIS_URL,
				services: resources.services,
				concurrency: definition.concurrency ?? config.WORKER_CONCURRENCY,
				logger: logger.child({ consumer: definition.name }),
			});
			consumers.push({ name: definition.name, worker });
			logger.info(
				{ consumer: definition.name, phase: "created" },
				"Consumer created",
			);
		}
		checkCancelled(signal);
		await waitForStartup(
			Promise.all(
				consumers.map(({ worker }) => attempt(() => worker.waitUntilReady())),
			),
			config.WORKER_STARTUP_TIMEOUT_MS,
			signal,
		);
		checkCancelled(signal);
		state = "running";
		for (const { name, worker } of consumers) {
			checkCancelled(signal);
			// Each loop is observed before starting the next consumer.
			const loop = worker.run().then(
				() => {
					if (state === "running" || state === "failed")
						recordFailure(
							consumerError(name, "stopped unexpectedly", undefined),
						);
				},
				(error: unknown) =>
					recordFailure(consumerError(name, "execution failed", error)),
			);
			loops.push(loop);
			logger.info({ consumer: name, phase: "running" }, "Consumer started");
		}
		checkCancelled(signal);
	} catch (error) {
		state = "closing";
		const errors: unknown[] = [error];
		try {
			await withDeadline(
				(async () => {
					const results = await Promise.allSettled(
						consumers.map(({ name, worker }) =>
							attempt(() => worker.close(true)).catch((cause: unknown) => {
								throw consumerError(name, "startup cleanup failed", cause);
							}),
						),
					);
					errors.push(...rejected(results));
					// Do not release shared resources beneath an unconfirmed live loop.
					if (
						loops.length === 0 ||
						results.every((result) => result.status === "fulfilled")
					) {
						await Promise.all(loops);
						if (state !== "closing") return;
						await resources.close();
					}
				})(),
				config.WORKER_SHUTDOWN_TIMEOUT_MS,
				"Worker startup cleanup timed out",
			);
		} catch (cleanupError) {
			errors.push(cleanupError);
		}
		state = "failed";
		errors.push(...loopErrors);
		if (errors.length > 1)
			throw new AggregateError(errors, "Worker startup and cleanup failed");
		throw error;
	}

	let closePromise: Promise<void> | undefined;
	let drained = false;
	return {
		done: completion.promise,
		async checkReady() {
			if (state !== "running") throw new Error("Worker is not running");
			await resources.checkReady();
			await Promise.all(
				consumers.map(async ({ name, worker }) => {
					if (!worker.isRunning())
						throw consumerError(name, "is not consuming", undefined);
					const client = await worker.client;
					if (client.status !== "ready")
						throw consumerError(name, "Redis is not ready", undefined);
					await client.get("full-stack:worker:health");
				}),
			);
			if (state !== "running")
				throw new Error("Worker stopped during readiness check");
		},
		close() {
			if (closePromise) return closePromise;
			state = "closing";
			closePromise = withDeadline(
				(async () => {
					const results = await Promise.allSettled(
						consumers.map(async ({ name, worker }) => {
							logger.info(
								{ consumer: name, phase: "closing" },
								"Consumer draining",
							);
							try {
								await worker.close();
							} catch (cause) {
								throw consumerError(name, "drain failed", cause);
							}
						}),
					);
					const errors = rejected(results);
					if (errors.length)
						throw new AggregateError(
							[...errors, ...loopErrors],
							"Consumer drain failed",
						);
					await Promise.all(loops);
					drained = true;
					// All consumers have stopped before the database can be closed.
					if (state !== "closing")
						throw new Error("Worker shutdown budget exhausted");
					await resources.close();
					if (state !== "closing")
						throw new Error("Worker shutdown budget exhausted");
					if (loopErrors.length)
						throw new AggregateError(loopErrors, "Consumer execution failed");
					state = "closed";
					completion.resolve();
				})(),
				config.WORKER_SHUTDOWN_TIMEOUT_MS,
				"Worker shutdown timed out",
			).catch((error: unknown) => {
				state = "failed";
				completion.reject(error);
				// Best effort only; the entry's hard exit owns the final deadline.
				for (const { worker } of drained ? [] : consumers)
					void attempt(() => worker.close(true)).catch(() => {});
				throw error;
			});
			void closePromise.catch(() => {});
			return closePromise;
		},
	};
}
