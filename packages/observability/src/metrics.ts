import {
	type Attributes,
	metrics,
	SpanStatusCode,
	trace,
} from "@opentelemetry/api";
import { withDeadline } from "./deadline";
import { traceOperation } from "./tracing";

export async function observeOperation<T>(
	operation: string,
	work: () => Promise<T>,
) {
	const histogram = metrics
		.getMeter("full-stack-example")
		.createHistogram("app.operation.duration", { unit: "s" });
	const started = performance.now();
	let outcome = "success";
	try {
		return await traceOperation(operation, work);
	} catch (error) {
		outcome = "error";
		throw error;
	} finally {
		histogram.record((performance.now() - started) / 1000, {
			operation,
			outcome,
		});
	}
}

export function observeHttp() {
	const meter = metrics.getMeter("full-stack-example");
	const count = meter.createCounter("http.server.requests");
	const duration = meter.createHistogram("http.server.request.duration", {
		unit: "s",
	});
	return (method: string, route: string, status: number, seconds: number) => {
		const attributes = {
			"http.request.method": method,
			"http.route": route,
			"http.response.status_code": status,
		};
		count.add(1, attributes);
		duration.record(seconds, attributes);
		const span = trace.getActiveSpan();
		span?.setAttributes(attributes);
		if (status >= 500) span?.setStatus({ code: SpanStatusCode.ERROR });
	};
}

export function observePool(
	pool: { totalCount: number; idleCount: number; waitingCount: number },
	role: string,
) {
	const meter = metrics.getMeter("full-stack-example");
	const connections = meter.createObservableGauge("db.pool.connections");
	const waiting = meter.createObservableGauge("db.pool.waiting");
	const callback: Parameters<typeof meter.addBatchObservableCallback>[0] = (
		result,
	) => {
		result.observe(connections, pool.idleCount, { pool: role, state: "idle" });
		result.observe(connections, pool.totalCount - pool.idleCount, {
			pool: role,
			state: "used",
		});
		result.observe(waiting, pool.waitingCount, { pool: role });
	};
	meter.addBatchObservableCallback(callback, [connections, waiting]);
	return () =>
		meter.removeBatchObservableCallback(callback, [connections, waiting]);
}

export function createQueueMetrics(queue: string) {
	const meter = metrics.getMeter("full-stack-example");
	const attempts = meter.createCounter("jobs.attempts");
	const duration = meter.createHistogram("jobs.process.duration", {
		unit: "s",
	});
	const delay = meter.createHistogram("jobs.queue.delay", { unit: "s" });
	return {
		start(timestamp: number) {
			delay.record(Math.max(0, Date.now() - timestamp) / 1000, { queue });
		},
		finish(outcome: string, seconds: number) {
			const attributes: Attributes = { queue, outcome };
			attempts.add(1, attributes);
			duration.record(seconds, attributes);
		},
	};
}

export function observeQueue(
	reader: {
		getJobCounts(...states: string[]): Promise<Record<string, number>>;
		getWaiting(start: number, end: number): Promise<{ timestamp: number }[]>;
	},
	queue: string,
) {
	const meter = metrics.getMeter("full-stack-example");
	const depth = meter.createObservableGauge("jobs.queue.depth");
	const age = meter.createObservableGauge("jobs.queue.oldest_age", {
		unit: "s",
	});
	let pending: Promise<void> | undefined;
	const callback: Parameters<typeof meter.addBatchObservableCallback>[0] =
		async (result) => {
			pending = (async () => {
				try {
					const [counts, jobs] = await withDeadline(
						Promise.all([
							reader.getJobCounts("waiting", "active", "delayed", "failed"),
							reader.getWaiting(0, 0),
						]),
						1500,
						"Queue observation timed out",
					);
					for (const [state, value] of Object.entries(counts))
						result.observe(depth, value, { queue, state });
					result.observe(
						age,
						jobs[0] ? Math.max(0, Date.now() - jobs[0].timestamp) / 1000 : 0,
						{ queue },
					);
				} catch {
					/* Dependency failures are represented by readiness; no fabricated zeroes. */
				}
			})();
			await pending;
		};
	meter.addBatchObservableCallback(callback, [depth, age]);
	return async () => {
		meter.removeBatchObservableCallback(callback, [depth, age]);
		await pending;
	};
}

export function observeProcess(loop: {
	percentile(value: number): number;
	reset(): void;
}) {
	const meter = metrics.getMeter("full-stack-example");
	const memory = meter.createObservableGauge("process.memory.usage", {
		unit: "By",
	});
	const eventLoop = meter.createObservableGauge("nodejs.eventloop.delay.p99", {
		unit: "s",
	});
	const callback: Parameters<typeof meter.addBatchObservableCallback>[0] = (
		result,
	) => {
		const usage = process.memoryUsage();
		result.observe(memory, usage.rss, { state: "rss" });
		result.observe(memory, usage.heapUsed, { state: "heap_used" });
		result.observe(eventLoop, loop.percentile(99) / 1e9);
		loop.reset();
	};
	meter.addBatchObservableCallback(callback, [memory, eventLoop]);
	return () =>
		meter.removeBatchObservableCallback(callback, [memory, eventLoop]);
}
