import { createLogger, withDeadline } from "@full-stack-example/observability";
import { startTelemetry } from "@full-stack-example/observability/telemetry";
import { ENV } from "./env.server";
import { startServer } from "./runtime";

const telemetry = startTelemetry("server", ENV);
const logger = createLogger("server", undefined, {
	level: ENV.LOG_LEVEL,
	version: ENV.OTEL_SERVICE_VERSION,
	environment: ENV.NODE_ENV,
});
const startup = startServer(ENV, logger);
let shutdownPromise: Promise<void> | undefined;
function shutdown() {
	shutdownPromise ??= (async () => {
		const timer = setTimeout(() => {
			logger.error("Server shutdown deadline exceeded");
			process.exit(1);
		}, ENV.SERVER_SHUTDOWN_TIMEOUT_MS);
		try {
			try {
				await (await startup).close();
			} finally {
				await telemetry.shutdown();
			}
		} finally {
			clearTimeout(timer);
		}
	})();
	return shutdownPromise;
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => {
		void shutdown().catch((err: unknown) => {
			logger.error({ err }, "Server shutdown failed");
			process.exit(1);
		});
	});
}
void startup
	.then(() => {
		if (!shutdownPromise) logger.info({ port: ENV.PORT }, "Server ready");
	})
	.catch(async (err: unknown) => {
		logger.error({ err }, "Server startup failed");
		try {
			await withDeadline(
				telemetry.shutdown(),
				3000,
				"Telemetry shutdown timed out",
			);
		} finally {
			process.exit(1);
		}
	});
