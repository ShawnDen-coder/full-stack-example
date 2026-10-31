import { type Logger, withDeadline } from "@full-stack-example/runtime/process";
import { startHeartbeat } from "./heartbeat";
import {
	startWorker,
	type WorkerConfig,
	WorkerStartupAbortedError,
} from "./runtime";

// The entry owns process policy; the runtime owns consumers and shared resources.
export function startWorkerProcess({
	config,
	logger,
	telemetry,
	exit,
	start = startWorker,
	heartbeat = (check, signal) => startHeartbeat(check, undefined, signal),
}: {
	config: WorkerConfig;
	logger: Logger;
	telemetry: { shutdown(): Promise<void> };
	exit(code: number): void;
	start?: typeof startWorker;
	heartbeat?: (
		check: () => Promise<void>,
		signal: AbortSignal,
	) => Promise<{ close(): Promise<void> }>;
}) {
	const controller = new AbortController();
	const startup = start({ config, logger, signal: controller.signal });
	let heartbeatStartup: Promise<{ close(): Promise<void> }> | undefined;
	let shutdownPromise: Promise<void> | undefined;
	let failed = false;
	function fail(err: unknown) {
		if (!failed)
			logger.error(
				{ err },
				"Worker stopped after a startup or execution failure",
			);
		failed = true;
		void shutdown();
	}
	function shutdown() {
		if (shutdownPromise) return shutdownPromise;
		controller.abort();
		shutdownPromise = (async () => {
			const deadline = setTimeout(() => {
				logger.error("Worker shutdown deadline exceeded");
				exit(1);
			}, config.WORKER_SHUTDOWN_TIMEOUT_MS);
			try {
				try {
					// Startup owns rollback on rejection; ready observes and reports it.
					const runtime = await startup.catch(() => undefined);
					try {
						await (await heartbeatStartup)?.close();
					} finally {
						await runtime?.close();
					}
				} finally {
					await withDeadline(
						telemetry.shutdown(),
						3000,
						"Telemetry shutdown timed out",
					);
				}
			} catch (err) {
				failed = true;
				logger.error({ err }, "Worker shutdown failed");
			} finally {
				clearTimeout(deadline);
				// A cleanup error may leave live handles. exitCode alone cannot terminate them.
				exit(failed ? 1 : 0);
			}
		})();
		return shutdownPromise;
	}
	const ready = startup
		.then(async (runtime) => {
			void runtime.done.catch(fail);
			if (controller.signal.aborted) return;
			heartbeatStartup = heartbeat(
				() => runtime.checkReady(),
				controller.signal,
			);
			const health = await heartbeatStartup;
			if (controller.signal.aborted) {
				await health.close();
				return;
			}
			logger.info("Worker consumers ready");
		})
		.catch((err: unknown) => {
			if (err instanceof WorkerStartupAbortedError && controller.signal.aborted)
				return;
			fail(err);
		});
	return { ready, shutdown };
}
