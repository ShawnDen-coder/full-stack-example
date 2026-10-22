import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { type ContextDependencies, createContext } from "./context";
import { appRouter } from "./routers/index";

export function createApi(deps: ContextDependencies & { corsOrigin: string }) {
	const app = new Hono();
	app.use(logger());
	app.use(
		"*",
		cors({
			origin: (origin) => (origin === deps.corsOrigin ? origin : undefined),
			allowMethods: ["GET", "POST", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	);
	app.onError(() => {
		console.error("HTTP request failed");
		return Response.json({ error: "Internal Server Error" }, { status: 500 });
	});
	app.on(["GET", "POST"], "/api/auth/*", (c) => deps.auth.handler(c.req.raw));
	app.get("/", (c) => c.text("OK"));
	app.get("/health", (c) => c.text("OK"));

	const rpcHandler = new RPCHandler(appRouter);
	const apiHandler = new OpenAPIHandler(appRouter, {
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
		const context = await createContext(c.req.raw.headers, deps);
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
