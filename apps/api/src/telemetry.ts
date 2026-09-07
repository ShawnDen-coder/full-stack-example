import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

export interface TelemetryOptions {
  readonly enabled: boolean;
  readonly endpoint: string;
  readonly metricExportIntervalMillis: number;
}

export async function startTelemetry(options: TelemetryOptions): Promise<{ readonly shutdown: () => Promise<void> }> {
  if (!options.enabled) return { shutdown: async () => undefined };
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: `${options.endpoint}/v1/traces` }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${options.endpoint}/v1/metrics` }),
        exportIntervalMillis: options.metricExportIntervalMillis,
      }),
    ],
  });
  sdk.start();
  return { shutdown: () => sdk.shutdown() };
}
