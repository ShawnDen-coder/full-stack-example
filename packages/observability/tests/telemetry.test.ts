import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
	InMemorySpanExporter,
	type SpanExporter,
} from "@opentelemetry/sdk-trace";
import {
	createLogger,
	observeHttp,
	observeOperation,
	traceRequest,
} from "../src/index";
import { startTelemetry } from "../src/telemetry";

const spans = new InMemorySpanExporter();
let rejectExports = false;
const exporter: SpanExporter = {
	export(items, done) {
		if (rejectExports)
			done({ code: 1, error: new Error("Collector unavailable") });
		else spans.export(items, done);
	},
	shutdown: () => spans.shutdown(),
};
const reader = new PeriodicExportingMetricReader({
	exporter: new InMemoryMetricExporter(),
	exportIntervalMillis: 60000,
});
const telemetry = startTelemetry(
	"test",
	{ OTEL_ENABLED: true },
	{ traceExporter: exporter, metricReader: reader },
);
after(async () => {
	await telemetry.shutdown();
});

test("parallel requests preserve parent traces and correlate logs without capturing secrets", async () => {
	const lines: string[] = [];
	const logger = createLogger("test", {
		write: (line) => {
			lines.push(line);
		},
	});
	const ids = [
		"11111111111111111111111111111111",
		"22222222222222222222222222222222",
	];
	const recordHttp = observeHttp();
	await Promise.all(
		ids.map((id) =>
			traceRequest(
				new Headers({
					traceparent: `00-${id}-1234567812345678-01`,
					cookie: "secret-cookie",
				}),
				"POST /rpc/users/me",
				async () => {
					await observeOperation("users.getProfile", async () => {
						await new Promise((resolve) => setTimeout(resolve, 5));
						logger.info({ event: "profile.read" }, "Profile read");
					});
					recordHttp("POST", "/rpc/users/me", 200, 0.01);
				},
			),
		),
	);
	const entries = lines.map((line) => JSON.parse(line));
	assert.deepEqual(
		new Set(entries.map((entry) => entry.trace_id)),
		new Set(ids),
	);
	for (const id of ids) {
		const related = spans
			.getFinishedSpans()
			.filter((span) => span.spanContext().traceId === id);
		assert.equal(related.length, 2);
		const request = related.find((span) => span.name.startsWith("POST"));
		const operation = related.find((span) => span.name === "users.getProfile");
		assert.equal(
			operation?.parentSpanContext?.spanId,
			request?.spanContext().spanId,
		);
	}
	assert.ok(
		!JSON.stringify(
			spans.getFinishedSpans().map(({ name, attributes, events, status }) => ({
				name,
				attributes,
				events,
				status,
			})),
		).includes("secret-cookie"),
	);
	const measured = await reader.collect();
	const text = JSON.stringify(measured.resourceMetrics);
	assert.ok(text.includes("http.server.request.duration"));
	assert.ok(text.includes("app.operation.duration"));
	assert.ok(!text.includes(ids[0] ?? "invalid"));
});

test("database failures mark spans without exporting driver messages or SQL parameters", async () => {
	await assert.rejects(() =>
		observeOperation("todos.create", async () => {
			throw new Error("Failed query: private SQL with password=secret");
		}),
	);
	const span = spans
		.getFinishedSpans()
		.findLast((item) => item.name === "todos.create");
	assert.equal(span?.status.code, 2);
	assert.ok(
		!JSON.stringify({
			attributes: span?.attributes,
			events: span?.events,
			status: span?.status,
		}).includes("private SQL"),
	);
});

test("export failure cannot fail a successful business operation", async () => {
	rejectExports = true;
	try {
		assert.equal(
			await observeOperation("users.getProfile", async () => "available"),
			"available",
		);
	} finally {
		rejectExports = false;
	}
});

test("telemetry shutdown is idempotent and disabled telemetry creates no exporter", async () => {
	const disabled = startTelemetry("disabled", {
		OTEL_ENABLED: false,
		OTEL_EXPORTER_OTLP_ENDPOINT: "invalid",
	});
	await disabled.shutdown();
	await disabled.shutdown();
	const first = telemetry.shutdown();
	assert.equal(telemetry.shutdown(), first);
	await first;
});
