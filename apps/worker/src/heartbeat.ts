import { rename, rm, writeFile } from "node:fs/promises";
import { withDeadline } from "@my-better-t-app/observability";

export const HEARTBEAT_FILE = "/tmp/full-stack-worker-ready.json";

// A fresh file means the consumer loop, PostgreSQL and Redis passed a bounded probe.
export async function startHeartbeat(
	checkReady: () => Promise<void>,
	file = HEARTBEAT_FILE,
) {
	let running = true;
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
	const interval = setInterval(() => void probe(), 5000);
	interval.unref();
	return {
		async close() {
			running = false;
			clearInterval(interval);
			await probing;
			await rm(file, { force: true });
		},
	};
}
