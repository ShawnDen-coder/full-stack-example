import { ENV } from "./env.server";
import { startWorker } from "./runtime";

const startup = startWorker(ENV);
let shutdownPromise: Promise<void> | undefined;
function shutdown() {
	shutdownPromise ??= (async () => {
		const deadline = setTimeout(() => {
			console.error("Worker shutdown deadline exceeded");
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

function fail() {
	console.error("Worker stopped after a startup or execution failure");
	process.exitCode = 1;
	void shutdown().catch(() => {
		console.error("Worker cleanup failed");
	});
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => {
		void shutdown().catch(() => {
			console.error("Worker shutdown failed");
			process.exitCode = 1;
		});
	});
}

void startup
	.then((runtime) => {
		if (!shutdownPromise) console.log("User profile worker ready");
		void runtime.done.catch(fail);
	})
	.catch(fail);
