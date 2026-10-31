import { createDb } from "@full-stack-example/db";
import { createUsersService } from "@full-stack-example/domain/users";
import type { Logger } from "pino";

export type WorkerResourceConfig = {
	DATABASE_URL: string;
	DB_POOL_MAX?: number;
	DB_QUERY_TIMEOUT_MS?: number;
	WORKER_STARTUP_TIMEOUT_MS: number;
};

export function createWorkerResources(
	config: WorkerResourceConfig,
	logger: Logger,
) {
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
}
