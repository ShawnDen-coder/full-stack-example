import type { RedisOptions } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

export type { Telemetry } from "bullmq";
export { Queue, Worker } from "bullmq";

export function createQueueTelemetry() {
	return new BullMQOtel("full-stack-example");
}

export function createQueueConnection(
	redisUrl: string,
	role: "producer" | "worker" = "producer",
): RedisOptions {
	const url = new URL(redisUrl);
	const db = Number(url.pathname.slice(1) || 0);
	if (
		!["redis:", "rediss:"].includes(url.protocol) ||
		!Number.isInteger(db) ||
		db < 0
	) {
		throw new Error("Invalid Redis connection configuration");
	}
	return {
		host: url.hostname.replace(/^\[|\]$/g, ""),
		port: Number(url.port || 6379),
		username: url.username ? decodeURIComponent(url.username) : undefined,
		password: url.password ? decodeURIComponent(url.password) : undefined,
		db,
		tls: url.protocol === "rediss:" ? {} : undefined,
		maxRetriesPerRequest: role === "worker" ? null : 1,
		enableOfflineQueue: role === "worker",
		commandTimeout: role === "worker" ? undefined : 2000,
		connectTimeout: 5000,
	};
}
