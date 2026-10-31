import { createProcessContext } from "@full-stack-example/runtime/process";
import { ENV } from "./env.server";
import { startWorkerProcess } from "./lifecycle";

const { logger, telemetry } = createProcessContext("worker", ENV);
const worker = startWorkerProcess({
	config: ENV,
	logger,
	telemetry,
	exit: (code) => process.exit(code),
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => void worker.shutdown());
}
