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
	let boundedProbe: Promise<void> | undefined;
	let dependencyCheckInFlight: Promise<void> | undefined;
	const probe = () => {
		if (boundedProbe || dependencyCheckInFlight || !running)
			return boundedProbe;
		const raw = Promise.resolve().then(checkReady);
		dependencyCheckInFlight = raw;
		void raw.then(
			() => {
				dependencyCheckInFlight = undefined;
			},
			() => {
				dependencyCheckInFlight = undefined;
			},
		);
		boundedProbe = (async () => {
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
				boundedProbe = undefined;
			}
		})();
		return boundedProbe;
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
			await boundedProbe;
			await rm(file, { force: true });
		},
	};
}
