import { isSpanContextValid, trace } from "@opentelemetry/api";
import pino, { type DestinationStream, type Logger } from "pino";

export type { Logger };

// Exceptions can contain URLs and SQL parameters. Keep the stack, but never
// serialize arbitrary driver properties, request bodies or nested causes.
export function safeText(value: string) {
	return value
		.replace(/Failed query:[\s\S]*/g, "Database query failed")
		.replace(
			/(?:postgres(?:ql)?|rediss?):\/\/[^\s"']+/gi,
			"[REDACTED_CONNECTION]",
		)
		.replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
		.replace(
			/((?:password|token|secret|authorization|cookie)\s*[=:]\s*)[^\s,;]+/gi,
			"$1[REDACTED]",
		);
}

export function createLogger(
	service: string,
	destination?: DestinationStream,
	config: { level?: string; version?: string; environment?: string } = {},
) {
	const options: pino.LoggerOptions = {
		level: config.level ?? "info",
		base: {
			service,
			version: config.version ?? "development",
			environment: config.environment ?? "development",
		},
		mixin() {
			const span = trace.getActiveSpan()?.spanContext();
			return span && isSpanContextValid(span)
				? { trace_id: span.traceId, span_id: span.spanId }
				: {};
		},
		redact: [
			"password",
			"token",
			"secret",
			"DATABASE_URL",
			"REDIS_URL",
			"authorization",
			"cookie",
			"headers.authorization",
			"headers.cookie",
			"headers.set-cookie",
			"*.password",
			"*.token",
			"*.secret",
		],
		serializers: {
			err: (error: unknown) =>
				error instanceof Error
					? {
							type: error.name,
							message: safeText(error.message),
							stack: error.stack
								? [
										safeText(error.message),
										...error.stack
											.split("\n")
											.filter((line) => line.trimStart().startsWith("at "))
											.map(safeText),
									].join("\n")
								: undefined,
						}
					: { type: "UnknownError" },
		},
	};
	return destination ? pino(options, destination) : pino(options);
}

export { withDeadline } from "./deadline";
export {
	createQueueMetrics,
	observeHttp,
	observeOperation,
	observePool,
	observeQueue,
} from "./metrics";
export { traceOperation, traceRequest } from "./tracing";
