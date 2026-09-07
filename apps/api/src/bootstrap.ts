import { serve } from "@hono/node-server";
import {
  checkDatabase,
  createDatabase,
  defaultMigrationsFolder,
  migrateDatabase,
} from "@full-stack-example/database";
import { createLogger } from "@full-stack-example/logging";
import { createApp } from "./app.js";
import { parseConfig } from "./config.js";

export async function bootstrap(): Promise<() => Promise<void>> {
  const config = parseConfig();
  const logger = createLogger({
    service: "api",
    environment: config.environment,
    level: config.logLevel,
    pretty: config.pretty,
  });
  logger.info({ event: "database.migration.started" }, "Running database migrations");
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
  logger.info({ event: "api.started", host: config.host, port: config.port }, "API server started");
  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;
    server.close();
    await database.close();
    logger.info({ event: "api.shutdown.completed" }, "API server stopped");
  };
}
