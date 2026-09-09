import { createAuthModule, createPermissionPolicy } from "@full-stack-example/auth/server";
import {
  checkDatabase,
  createDatabase,
  defaultMigrationsFolder,
  migrateDatabase,
} from "@full-stack-example/database";
import {
  configureLogging,
  createLogStream,
  getAppLogger,
  shutdownLogging,
} from "@full-stack-example/logging";
import { createTodoRepository, createTodoService } from "@full-stack-example/todos";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { parseConfig } from "./config.js";
import { startTelemetry } from "./telemetry.js";

export async function bootstrap(): Promise<() => Promise<void>> {
  const config = parseConfig();
  const logStream = createLogStream({ capacity: config.logStreamBufferSize });
  await configureLogging({
    service: "api",
    environment: config.environment,
    level: config.logLevel,
    pretty: config.pretty,
    stream: logStream,
    ...(config.logFile ? { filePath: config.logFile } : {}),
  });
  const logger = getAppLogger(["api", "bootstrap"]);
  logger.info("Running database migrations", { event: "database.migration.started" });
  let telemetry: Awaited<ReturnType<typeof startTelemetry>> | undefined;
  let database: ReturnType<typeof createDatabase> | undefined;
  let server: ReturnType<typeof serve> | undefined;
  let closed = false;
  const cleanup = async () => {
    if (closed) return;
    closed = true;
    const activeServer = server;
    if (activeServer)
      await new Promise<void>((resolveClose, rejectClose) =>
        activeServer.close((error) => (error ? rejectClose(error) : resolveClose())),
      );
    const activeDatabase = database;
    if (activeDatabase) await activeDatabase.close();
    if (telemetry) await telemetry.shutdown();
    logger.info("API server stopped", { event: "api.shutdown.completed" });
    await shutdownLogging();
  };
  try {
    telemetry = await startTelemetry({
      enabled: config.otelEnabled,
      endpoint: config.otelEndpoint,
      metricExportIntervalMillis: config.otelMetricExportInterval,
    });
    await migrateDatabase({
      databaseUrl: config.databaseUrl,
      migrationsFolder: defaultMigrationsFolder,
    });
    const databaseContext = createDatabase({ databaseUrl: config.databaseUrl });
    database = databaseContext;
    const auth = createAuthModule({
      database: databaseContext.db,
      baseURL: config.betterAuthUrl,
      secret: config.betterAuthSecret,
      trustedOrigins: [config.webOrigin],
      policy: createPermissionPolicy({
        roles: {
          owner: { todos: ["read", "write", "delete"] },
          admin: { todos: ["read", "write", "delete"] },
          member: { todos: ["read", "write"] },
        },
      }),
    });
    const todoService = createTodoService(createTodoRepository(databaseContext.db));
    const app = createApp({
      checkDatabase: () => checkDatabase(databaseContext.db),
      logger,
      webOrigin: config.webOrigin,
      todoService,
      auth,
      ...(config.webAssetsDirectory ? { webAssetsDirectory: config.webAssetsDirectory } : {}),
      ...(config.logStreamEnabled
        ? { logStream, logStreamHeartbeatMs: config.logStreamHeartbeatMs }
        : {}),
    });
    server = serve({ fetch: app.fetch, hostname: config.host, port: config.port });
    logger.info("API server started", {
      event: "api.started",
      host: config.host,
      port: config.port,
    });
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}
