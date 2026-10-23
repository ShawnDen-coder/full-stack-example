import { createLogger } from "@my-better-t-app/logger";
import { ENV } from "./env.server";
import { startServer } from "./runtime";

const logger = createLogger("server");
const startup = startServer(ENV, logger);
let shutdownPromise: Promise<void> | undefined;
function shutdown() {
	shutdownPromise ??= (async () => {
		const timer = setTimeout(() => {
			logger.error("Server shutdown deadline exceeded");
			process.exit(1);
		}, ENV.SERVER_SHUTDOWN_TIMEOUT_MS);
		try {
			await (await startup).close();
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
	.catch((err: unknown) => {
		logger.error({ err }, "Server startup failed");
		process.exit(1);
	});
