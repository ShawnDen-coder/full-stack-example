import { createLogger } from "@my-better-t-app/observability";
import { startTelemetry } from "@my-better-t-app/observability/telemetry";
import { ENV } from "./env.server";
import { startWorkerProcess } from "./lifecycle";

const telemetry = startTelemetry("worker", ENV);
const logger = createLogger("worker", undefined, {
	level: ENV.LOG_LEVEL,
	version: ENV.OTEL_SERVICE_VERSION,
	environment: ENV.NODE_ENV,
});
const worker = startWorkerProcess({
	config: ENV,
	logger,
	telemetry,
	exit: (code) => process.exit(code),
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => void worker.shutdown());
}
