import {
	type Attributes,
	context,
	propagation,
	ROOT_CONTEXT,
	SpanKind,
	SpanStatusCode,
	trace,
} from "@opentelemetry/api";

// Explicit boundaries work in development and in bundled ESM production output.
export function traceRequest<T>(
	headers: Headers,
	route: string,
	work: () => Promise<T>,
) {
	const carrier = {
		traceparent: headers.get("traceparent") ?? "",
		tracestate: headers.get("tracestate") ?? "",
	};
	const parent = propagation.extract(ROOT_CONTEXT, carrier);
	return context.with(parent, () =>
		traceOperation(route, work, { "http.route": route }, SpanKind.SERVER),
	);
}

export function traceOperation<T>(
	name: string,
	work: () => Promise<T>,
	attributes: Attributes = {},
	kind = SpanKind.INTERNAL,
): Promise<T> {
	return trace
		.getTracer("full-stack-example")
		.startActiveSpan(name, { attributes, kind }, async (span) => {
			try {
				return await work();
			} catch (error) {
				// Driver exceptions may include SQL parameters or credentials.
				span.setStatus({ code: SpanStatusCode.ERROR });
				throw error;
			} finally {
				span.end();
			}
		});
}
