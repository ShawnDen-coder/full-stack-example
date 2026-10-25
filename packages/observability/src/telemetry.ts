import { randomUUID } from "node:crypto";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
	type MetricReader,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
	ParentBasedSampler,
	SimpleSpanProcessor,
	type SpanExporter,
	TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace";
import { observeProcess } from "./metrics";

export type TelemetryConfig = {
	OTEL_ENABLED?: boolean;
	OTEL_EXPORTER_OTLP_ENDPOINT?: string;
	OTEL_SERVICE_VERSION?: string;
	OTEL_TRACES_SAMPLER_ARG?: number;
	NODE_ENV?: string;
};

// No SDK or exporter is constructed at import time. The process entry owns it.
export function startTelemetry(
	service: string,
	config: TelemetryConfig,
	options: {
		traceExporter?: SpanExporter;
		metricReader?: MetricReader | null;
	} = {},
) {
	if (!config.OTEL_ENABLED) return { shutdown: async () => {} };
	const endpoint = (
		config.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318"
	).replace(/\/$/, "");
	const sdk = new NodeSDK({
		autoDetectResources: false,
		logRecordProcessors: [],
		resource: resourceFromAttributes({
			"service.name": service,
			"service.instance.id": randomUUID(),
			"service.version": config.OTEL_SERVICE_VERSION || "development",
			"deployment.environment.name": config.NODE_ENV || "development",
		}),
		sampler: new ParentBasedSampler({
			root: new TraceIdRatioBasedSampler(config.OTEL_TRACES_SAMPLER_ARG ?? 1),
		}),
		traceExporter:
			options.traceExporter ??
			new OTLPTraceExporter({
				url: `${endpoint}/v1/traces`,
				timeoutMillis: 2000,
			}),
		spanProcessors: options.traceExporter
			? [new SimpleSpanProcessor({ exporter: options.traceExporter })]
			: undefined,
		metricReaders:
			options.metricReader === null
				? []
				: [
						options.metricReader ??
							new PeriodicExportingMetricReader({
								exporter: new OTLPMetricExporter({
									url: `${endpoint}/v1/metrics`,
									timeoutMillis: 2000,
								}),
								exportIntervalMillis: 15000,
								exportTimeoutMillis: 3000,
							}),
					],
		instrumentations: [],
	});
	sdk.start();
	const loop = monitorEventLoopDelay({ resolution: 20 });
	loop.enable();
	const stopProcessMetrics = observeProcess(loop);
	let shutdown: Promise<void> | undefined;
	return {
		shutdown() {
			shutdown ??= (async () => {
				try {
					await sdk.shutdown();
				} finally {
					stopProcessMetrics();
					loop.disable();
				}
			})();
			return shutdown;
		},
	};
}
