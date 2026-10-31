import { rename, rm, writeFile } from "node:fs/promises";
import { withDeadline } from "@full-stack-example/runtime/process";

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
	let inFlight: Promise<void> | undefined;
	const probe = () => {
		if (probing || inFlight || !running) return probing;
		const raw = Promise.resolve().then(checkReady);
		inFlight = raw;
		void raw.then(
			() => {
				inFlight = undefined;
			},
			() => {
				inFlight = undefined;
			},
		);
		probing = (async () => {
			try {
				await withDeadline(raw, 2000, "Worker readiness timed out");
				if (!running) return;
				await writeFile(
					`${file}.tmp`,
					JSON.stringify({ timestamp: Date.now() }),
				);
				if (running) await rename(`${file}.tmp`, file);
				else await rm(`${file}.tmp`, { force: true });
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
