import { randomUUID } from "node:crypto";
import { withDeadline } from "@my-better-t-app/logger";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
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

export function createApi(
	deps: ContextDependencies & {
		corsOrigin: string;
		checkReady: () => Promise<void>;
		isReady?: () => boolean;
	},
) {
	const app = new Hono<{ Variables: { requestId: string } }>();
	app.use("*", async (c, next) => {
		const requestId = randomUUID();
		c.set("requestId", requestId);
		c.header("X-Request-ID", requestId);
		const start = performance.now();
		await next();
		deps.logger.info(
			{
				requestId,
				method: c.req.method,
				status: c.res.status,
				durationMs: Math.round(performance.now() - start),
			},
			"HTTP request",
		);
	});
	app.use(
		"*",
		cors({
			origin: (origin) => (origin === deps.corsOrigin ? origin : undefined),
			allowMethods: ["GET", "POST", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization"],
			exposeHeaders: ["X-Request-ID"],
			credentials: true,
		}),
	);
	app.onError((err, c) => {
		deps.logger.error(
			{ err, requestId: c.get("requestId") },
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
				{ err, requestId: c.get("requestId") },
				"Readiness failed",
			);
			return c.json({ status: "unavailable" }, 503);
		}
	});
	const interceptors: RPCHandlerOptions<Context>["interceptors"] = [
		onError((err, { context }) => {
			context.logger.error({ err }, "RPC request failed");
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
