import { serve } from "@hono/node-server";
import { createApi } from "@my-better-t-app/api/create-api";
import { ENV } from "./env.server";
import { createServices } from "./services";

const runtime = createServices(ENV);
const { app } = createApi({ ...runtime, corsOrigin: ENV.CORS_ORIGIN });
const server = serve({ fetch: app.fetch, port: 3000 }, (info) => {
	console.log(`Server is running on http://localhost:${info.port}`);
});

let shutdownPromise: Promise<void> | undefined;
function shutdown() {
	shutdownPromise ??= (async () => {
		try {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			);
		} finally {
			await runtime.close();
		}
	})();
	return shutdownPromise;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => {
		void shutdown().catch(() => {
			console.error("Server shutdown failed");
			process.exitCode = 1;
		});
	});
}
