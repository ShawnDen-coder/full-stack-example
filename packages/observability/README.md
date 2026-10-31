# @full-stack-example/observability

[English](README.md) · [简体中文](README.zh-CN.md) · [Project](../../README.md)

Structured Pino logs, explicit OpenTelemetry traces/metrics and bounded lifecycle
deadlines shared by the server, Worker and business services.

## Entry points

| File | Responsibility |
| --- | --- |
| [src/index.ts](src/index.ts) | Logger factory, redaction, safe error text and public helpers |
| [src/tracing.ts](src/tracing.ts) | Request context extraction and named operation spans |
| [src/metrics.ts](src/metrics.ts) | HTTP, operation, database pool, queue and process metrics |
| [src/telemetry.ts](src/telemetry.ts) | Explicit per-process SDK startup and shutdown |
| [src/deadline.ts](src/deadline.ts) | Promise deadline helper |
| [tests/telemetry.test.ts](tests/telemetry.test.ts) | Isolation, secret exclusion and exporter failure checks |

## Extend

1. For a new business operation, call `observeOperation("feature.operation", work)`
   from its service. It already records a span, duration and outcome; avoid
   wrapping the same work again just to create duplicate telemetry.
2. For new metrics, use stable names, units and bounded labels such as operation,
   queue and outcome. Keep request/user/job IDs in appropriate logs, not labels;
   do not export SQL parameters, bodies, credentials or arbitrary error text.
3. Use the injected logger and structured events. Extend redaction/error
   serialization together with secret-exclusion tests. Log exceptions at the
   owning boundary rather than repeatedly logging and rethrowing them.
4. Observable callbacks must tolerate dependency failures; observer registration
   helpers must expose cleanup functions. Detach them, await in-flight observations,
   then close their clients.
5. Keep SDK/exporter creation in `startTelemetry`, called from application entry
   points. Importing helpers must remain safe; exporters never become readiness
   dependencies. Drain work and close resources before SDK shutdown.
6. Add public helpers through `src/index.ts`; keep SDK startup under the existing
   `./telemetry` export. When adding external runtime vendors, review application
   dependency declarations and isolated production bundles.

## Example: measure generated export size

Suppose a future export feature needs CSV/JSON output-size measurements. Add this
factory to [src/metrics.ts](src/metrics.ts), where `metrics` is already imported:

```ts
export function createExportMetrics() {
  const size = metrics.getMeter("full-stack-example").createHistogram(
    "exports.result.size",
    { unit: "By" },
  );
  return {
    recordBytes(format: "csv" | "json", bytes: number) {
      size.record(bytes, { format });
    },
  };
}
```

Add `createExportMetrics` to the existing `./metrics` re-export in `src/index.ts`.
No new package subpath is necessary. This factory is an extension example, not
an existing export. Create it in the owning service factory, then record after
generating a document:

```ts
const exportMetrics = createExportMetrics();
// Inside the export operation, after generating its CSV string:
exportMetrics.recordBytes("csv", Buffer.byteLength(csv, "utf8"));
```

Only `format` is a metric attribute; do not add user IDs, filenames or job IDs.
Let `observeOperation("exports.generate", work)` measure duration and errors
around the business operation, rather than duplicating those measurements here.
Keep SDK creation and shutdown in the application entry.

Extend [telemetry tests](tests/telemetry.test.ts) using the existing in-memory
metric reader: record 128 bytes, collect, and assert the histogram name, `By`
unit, value and `format` attribute. Check disabled telemetry and exporter failure
still allow document generation. No Collector or readiness dependency is added.

## Verify

Run from the workspace root:

```bash
pnpm --filter @full-stack-example/observability test
pnpm --filter @full-stack-example/observability check-types
```

Follow [observability operations](../../docs/observability.md) for Collector setup,
fields and failure scenarios. Use real-service integration tests for BullMQ
propagation. Verify disabled telemetry and Collector outages still permit business
operations; the diagnostic Collector does not provide durable trace/log storage.

## Lx

L1. [Dependency policy / 依赖规则](../../docs/dependency-layers.md).
