import { createLogger, withDeadline } from "@my-better-t-app/observability";
import { startTelemetry } from "@my-better-t-app/observability/telemetry";
import { ENV } from "./env.server";
import { startHeartbeat } from "./heartbeat";
import { startWorker } from "./runtime";

const telemetry = startTelemetry("worker", ENV);
const logger = createLogger("worker", undefined, {
	level: ENV.LOG_LEVEL,
	version: ENV.OTEL_SERVICE_VERSION,
	environment: ENV.NODE_ENV,
});
const startup = startWorker(ENV, undefined, logger);
let heartbeat: Awaited<ReturnType<typeof startHeartbeat>> | undefined;
let shutdownPromise: Promise<void> | undefined;
function shutdown() {
	shutdownPromise ??= (async () => {
		const deadline = setTimeout(() => {
			logger.error("Worker shutdown deadline exceeded");
			process.exit(1);
		}, ENV.WORKER_SHUTDOWN_TIMEOUT_MS);
		try {
			try {
				const runtime = await startup;
				try {
					await heartbeat?.close();
				} finally {
					await runtime.close();
				}
			} finally {
				await withDeadline(
					telemetry.shutdown(),
					3000,
					"Telemetry shutdown timed out",
				);
			}
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
	.then(async (runtime) => {
		void runtime.done.catch(fail);
		if (shutdownPromise) return;
		const readyHeartbeat = await startHeartbeat(() => runtime.checkReady());
		if (shutdownPromise) {
			await readyHeartbeat.close();
			return;
		}
		heartbeat = readyHeartbeat;
		logger.info("User profile worker ready");
	})
	.catch(fail);
