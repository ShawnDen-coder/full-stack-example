import {
	createLogger as createBaseLogger,
	withDeadline as deadline,
} from "@full-stack-example/observability";
import { startTelemetry } from "@full-stack-example/observability/telemetry";
import type { DestinationStream, Logger } from "pino";

export type { Logger } from "pino";

export type ProcessConfig = {
	LOG_LEVEL?: string;
	NODE_ENV?: string;
	OTEL_ENABLED?: boolean;
	OTEL_EXPORTER_OTLP_ENDPOINT?: string;
	OTEL_SERVICE_VERSION?: string;
	OTEL_TRACES_SAMPLER_ARG?: number;
};

// Process identity and logging/telemetry configuration are assembled together.
// Calling this factory is explicit; importing this module creates no resources.
export function createProcessContext(service: string, config: ProcessConfig) {
	return {
		logger: createBaseLogger(service, undefined, {
			level: config.LOG_LEVEL,
			version: config.OTEL_SERVICE_VERSION,
			environment: config.NODE_ENV,
		}),
		telemetry: startTelemetry(service, config),
	};
}

// Standalone runtimes and tests can create a logger without starting an SDK.
export function createLogger(
	service: string,
	destination?: DestinationStream,
): Logger {
	return createBaseLogger(service, destination);
}

// Runtime deadlines cover startup, readiness and drain, independently of telemetry.
export function withDeadline<T>(
	work: Promise<T>,
	timeoutMs: number,
	message: string,
) {
	return deadline(work, timeoutMs, message);
}
