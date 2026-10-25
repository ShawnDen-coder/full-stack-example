import { createApi } from "@full-stack-example/api/create-api";
import { type Logger, withDeadline } from "@full-stack-example/observability";
import { serve } from "@hono/node-server";
import { createServices, type ServerConfig } from "./services";

export type RuntimeConfig = ServerConfig & {
	PORT: number;
	SERVER_STARTUP_TIMEOUT_MS: number;
	SERVER_SHUTDOWN_TIMEOUT_MS: number;
};
export async function startServer(config: RuntimeConfig, logger: Logger) {
	const runtime = createServices(config, logger);
	let ready = false;
	let server: ReturnType<typeof serve> | undefined;
	try {
		await withDeadline(
			runtime.checkReady(),
			config.SERVER_STARTUP_TIMEOUT_MS,
			"Server startup timed out",
		);
		const { app } = createApi({
			...runtime,
			corsOrigin: config.CORS_ORIGIN,
			checkReady: runtime.checkReady,
			isReady: () => ready,
		});
		server = serve({
			fetch: app.fetch,
			port: config.PORT,
			hostname: "0.0.0.0",
		});
		const listeningServer = server;
		await new Promise<void>((resolve, reject) => {
			listeningServer.once("error", reject);
			if (listeningServer.listening) resolve();
			else listeningServer.once("listening", resolve);
		});
		ready = true;
		server.on("error", (err) => logger.error({ err }, "HTTP server error"));
		let closePromise: Promise<void> | undefined;
		return {
			server,
			close() {
				ready = false;
				closePromise ??= withDeadline(
					(async () => {
						try {
							await new Promise<void>((resolve, reject) =>
								listeningServer.close((err) => (err ? reject(err) : resolve())),
							);
						} finally {
							await runtime.close();
						}
					})(),
					config.SERVER_SHUTDOWN_TIMEOUT_MS,
					"Server shutdown timed out",
				).catch((error: unknown) => {
					if ("closeAllConnections" in listeningServer)
						listeningServer.closeAllConnections();
					throw error;
				});
				return closePromise;
			},
		};
	} catch (error) {
		if (server && "closeAllConnections" in server) server.closeAllConnections();
		server?.close();
		try {
			await withDeadline(
				runtime.close(),
				config.SERVER_SHUTDOWN_TIMEOUT_MS,
				"Startup cleanup timed out",
			);
		} catch (err) {
			logger.error({ err }, "Server startup cleanup failed");
		}
		throw error;
	}
}
