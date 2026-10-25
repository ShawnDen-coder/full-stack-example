import { rename, rm, writeFile } from "node:fs/promises";
import { withDeadline } from "@full-stack-example/observability";

export const HEARTBEAT_FILE = "/tmp/full-stack-worker-ready.json";

// A fresh file means the consumer loop, PostgreSQL and Redis passed a bounded probe.
export async function startHeartbeat(
	checkReady: () => Promise<void>,
	file = HEARTBEAT_FILE,
	signal?: AbortSignal,
) {
	let running = !signal?.aborted;
	let interval: ReturnType<typeof setInterval> | undefined;
	const stop = () => {
		running = false;
		clearInterval(interval);
	};
	signal?.addEventListener("abort", stop, { once: true });
	let probing: Promise<void> | undefined;
	const probe = () => {
		if (probing) return probing;
		probing = (async () => {
			try {
				await withDeadline(checkReady(), 2000, "Worker readiness timed out");
				if (!running) return;
				await writeFile(
					`${file}.tmp`,
					JSON.stringify({ timestamp: Date.now() }),
				);
				await rename(`${file}.tmp`, file);
			} catch {
				await rm(file, { force: true });
			} finally {
				probing = undefined;
			}
		})();
		return probing;
	};
	await rm(file, { force: true });
	await probe();
	if (running) {
		interval = setInterval(() => void probe(), 5000);
		interval.unref();
	}
	return {
		async close() {
			stop();
			signal?.removeEventListener("abort", stop);
			await probing;
			await rm(file, { force: true });
		},
	};
}
