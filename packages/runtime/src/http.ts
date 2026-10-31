import { observeHttp, traceRequest } from "@full-stack-example/observability";
import type { Logger } from "pino";

export function createHttpObserver(logger: Logger) {
	const recordHttp = observeHttp();
	return async (
		request: {
			headers: Headers;
			method: string;
			route: string;
			requestId: string;
			status(): number;
		},
		work: () => Promise<void>,
	) =>
		traceRequest(
			request.headers,
			`${request.method} ${request.route}`,
			async () => {
				const started = performance.now();
				try {
					await work();
				} finally {
					const duration = (performance.now() - started) / 1000;
					const status = request.status();
					recordHttp(request.method, request.route, status, duration);
					logger.info(
						{
							event: "http.completed",
							request_id: request.requestId,
							method: request.method,
							route: request.route,
							status,
							duration_ms: Math.round(duration * 1000),
						},
						"HTTP request",
					);
				}
			},
		);
}
