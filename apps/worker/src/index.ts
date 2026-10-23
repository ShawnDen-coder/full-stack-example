import { createLogger } from "@my-better-t-app/logger";
import { ENV } from "./env.server";
import { startWorker } from "./runtime";

const logger = createLogger("worker");
const startup = startWorker(ENV, undefined, logger);
let shutdownPromise: Promise<void> | undefined;
function shutdown() {
	shutdownPromise ??= (async () => {
		const deadline = setTimeout(() => {
			logger.error("Worker shutdown deadline exceeded");
			process.exit(1);
		}, ENV.WORKER_SHUTDOWN_TIMEOUT_MS);
		try {
			const runtime = await startup;
			await runtime.close();
		} finally {
			clearTimeout(deadline);
		}
	})();
	return shutdownPromise;
}

function fail(err: unknown) {
	logger.error({ err }, "Worker stopped after a startup or execution failure");
	process.exitCode = 1;
	void shutdown().catch((err: unknown) => {
		logger.error({ err }, "Worker cleanup failed");
	});
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => {
		void shutdown().catch((err: unknown) => {
			logger.error({ err }, "Worker shutdown failed");
			process.exitCode = 1;
		});
	});
}

void startup
	.then((runtime) => {
		if (!shutdownPromise) logger.info("User profile worker ready");
		void runtime.done.catch(fail);
	})
	.catch(fail);
