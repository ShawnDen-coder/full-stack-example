import { serve } from "@hono/node-server";
import {
  checkDatabase,
  createDatabase,
  defaultMigrationsFolder,
  migrateDatabase,
} from "@full-stack-example/database";
import { configureLogging, createLogStream, getAppLogger, shutdownLogging } from "@full-stack-example/logging";
import { createApp } from "./app.js";
import { parseConfig } from "./config.js";
import { startTelemetry } from "./telemetry.js";

export async function bootstrap(): Promise<() => Promise<void>> {
  const config = parseConfig();
  const logStream = createLogStream();
  await configureLogging({
    service: "api",
    environment: config.environment,
    level: config.logLevel,
    pretty: config.pretty,
    stream: logStream,
  });
  const logger = getAppLogger(["api", "bootstrap"]);
  logger.info("Running database migrations", { event: "database.migration.started" });
  const telemetry = await startTelemetry({
    enabled: config.otelEnabled,
    endpoint: config.otelEndpoint,
    metricExportIntervalMillis: config.otelMetricExportInterval,
  });
  await migrateDatabase({
    databaseUrl: config.databaseUrl,
    migrationsFolder: defaultMigrationsFolder,
  });
  const database = createDatabase({ databaseUrl: config.databaseUrl });
  const app = createApp({
    checkDatabase: () => checkDatabase(database.db),
    logger,
    webOrigin: config.webOrigin,
  });
  const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port });
  logger.info("API server started", { event: "api.started", host: config.host, port: config.port });
  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;
    server.close();
    await database.close();
    await telemetry.shutdown();
    logger.info("API server stopped", { event: "api.shutdown.completed" });
    await shutdownLogging();
  };
}
