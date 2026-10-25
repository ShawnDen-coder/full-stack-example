import { randomUUID } from "node:crypto";
import {
	observeHttp,
	traceRequest,
	withDeadline,
} from "@full-stack-example/observability";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { isProcedure, ORPCError, onError } from "@orpc/server";
import { RPCHandler, type RPCHandlerOptions } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
	type Context,
	type ContextDependencies,
	createContext,
} from "./context";
import { appRouter } from "./routers/index";

// Derive the finite label set from the same router that serves requests.
function procedurePaths(router: object, prefix = "/rpc"): string[] {
	return Object.entries(router).flatMap(([name, value]) => {
		const path = `${prefix}/${name}`;
		if (isProcedure(value)) return [path];
		return value && typeof value === "object"
			? procedurePaths(value, path)
			: [];
	});
}
const registeredRpcPaths = new Set(procedurePaths(appRouter));

export function createApi(
	deps: ContextDependencies & {
		corsOrigin: string;
		checkReady: () => Promise<void>;
		checkJobsReady?: () => Promise<void>;
		isReady?: () => boolean;
	},
) {
	const app = new Hono<{ Variables: { requestId: string } }>();
	const recordHttp = observeHttp();
	app.use("*", async (c, next) => {
		const requestId = randomUUID();
		c.set("requestId", requestId);
		c.header("X-Request-ID", requestId);
		const path = c.req.path;
		const method = [
			"GET",
			"POST",
			"PUT",
			"PATCH",
			"DELETE",
			"HEAD",
			"OPTIONS",
			"TRACE",
			"CONNECT",
		].includes(c.req.method)
			? c.req.method
			: "_OTHER";
		// Only registered names become labels. Unknown URLs and auth inputs are never logged.
		const route = registeredRpcPaths.has(path)
			? path
			: path.startsWith("/api/auth/")
				? "/api/auth/*"
				: ["/", "/health", "/ready", "/ready/jobs", "/api-reference"].includes(
							path,
						)
					? path
					: "unmatched";
		if (path === "/health" || path === "/ready" || path === "/ready/jobs")
			return next();
		return traceRequest(c.req.raw.headers, `${method} ${route}`, async () => {
			const started = performance.now();
			try {
				await next();
			} finally {
				const duration = (performance.now() - started) / 1000;
				recordHttp(method, route, c.res.status, duration);
				deps.logger.info(
					{
						event: "http.completed",
						request_id: requestId,
						method,
						route,
						status: c.res.status,
						duration_ms: Math.round(duration * 1000),
					},
					"HTTP request",
				);
			}
		});
	});
	app.use(
		"*",
		cors({
			origin: (origin) => (origin === deps.corsOrigin ? origin : undefined),
			allowMethods: ["GET", "POST", "OPTIONS"],
			allowHeaders: [
				"Content-Type",
				"Authorization",
				"traceparent",
				"tracestate",
			],
			exposeHeaders: ["X-Request-ID"],
			credentials: true,
		}),
	);
	app.onError((err, c) => {
		deps.logger.error(
			{ err, event: "http.failed", request_id: c.get("requestId") },
			"HTTP request failed",
		);
		return c.json({ error: "Internal Server Error" }, 500);
	});
	app.on(["GET", "POST"], "/api/auth/*", (c) => deps.auth.handler(c.req.raw));
	app.get("/", (c) => c.text("OK"));
	app.get("/health", (c) => c.text("OK"));

	app.get("/ready", async (c) => {
		if (deps.isReady && !deps.isReady())
			return c.json({ status: "unavailable" }, 503);
		try {
			await withDeadline(deps.checkReady(), 2000, "Readiness timed out");
			return c.json({ status: "ready" });
		} catch (err) {
			deps.logger.warn(
				{ err, event: "http.failed", request_id: c.get("requestId") },
				"Readiness failed",
			);
			return c.json({ status: "unavailable" }, 503);
		}
	});
	app.get("/ready/jobs", async (c) => {
		if (deps.isReady && !deps.isReady())
			return c.json({ status: "unavailable" }, 503);
		try {
			if (!deps.checkJobsReady) return c.json({ status: "unavailable" }, 503);
			await withDeadline(
				deps.checkJobsReady(),
				2000,
				"Jobs readiness timed out",
			);
			return c.json({ status: "ready" });
		} catch {
			return c.json({ status: "unavailable" }, 503);
		}
	});
	const interceptors: RPCHandlerOptions<Context>["interceptors"] = [
		onError((err, { context }) => {
			if (err instanceof ORPCError && err.status < 500) {
				context.logger.info(
					{ event: "rpc.rejected", code: err.code },
					"RPC request rejected",
				);
			} else {
				context.logger.error(
					{ err, event: "rpc.failed" },
					"RPC request failed",
				);
			}
		}),
	];
	const rpcHandler = new RPCHandler(appRouter, { interceptors });
	const apiHandler = new OpenAPIHandler(appRouter, {
		interceptors,
		plugins: [
			new OpenAPIReferencePlugin({
				schemaConverters: [new ZodToJsonSchemaConverter()],
			}),
		],
	});

	app.use("*", async (c, next) => {
		const path = c.req.path;
		const isRpc = path === "/rpc" || path.startsWith("/rpc/");
		const isApi =
			path === "/api-reference" || path.startsWith("/api-reference/");
		if (!isRpc && !isApi) return next();
		const context = await createContext(
			c.req.raw.headers,
			deps,
			c.get("requestId"),
		);
		const handler = isRpc ? rpcHandler : apiHandler;
		const result = await handler.handle(c.req.raw, {
			prefix: isRpc ? "/rpc" : "/api-reference",
			context,
		});
		if (result.matched) return result.response;
		return next();
	});

	return { app };
}
