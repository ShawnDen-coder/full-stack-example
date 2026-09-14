import { createAuthModule, createPermissionPolicy } from "@full-stack-example/auth/server";
import {
  assertDatabaseMigrations,
  checkDatabase,
  createDatabase,
} from "@full-stack-example/database";
import { createBullMqJobs } from "@full-stack-example/jobs/server";
import {
  configureLogging,
  createLogStream,
  getAppLogger,
  shutdownLogging,
} from "@full-stack-example/logging";
import { createTodoService } from "@full-stack-example/todos";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { parseConfig } from "./config.js";
import { startTelemetry } from "./telemetry.js";
import { waitForListening } from "./wait-for-listening.js";

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
  let telemetry: Awaited<ReturnType<typeof startTelemetry>> | undefined;
  let database: ReturnType<typeof createDatabase> | undefined;
  let server: ReturnType<typeof serve> | undefined;
  let serverListening = false;
  let jobs: Awaited<ReturnType<typeof createBullMqJobs>> | undefined;
  let closed = false;
  const cleanup = async () => {
    if (closed) return;
    closed = true;
    const failures: unknown[] = [];
    const closeResource = async (name: string, close: () => Promise<unknown>) => {
      try {
        await close();
      } catch (error) {
        failures.push(error);
        logger.error("API shutdown resource failed", {
          event: "api.shutdown.resource_failed",
          resource: name,
          error,
        });
      }
    };
    const activeServer = server;
    if (activeServer && serverListening)
      await closeResource(
        "http-server",
        () =>
          new Promise<void>((resolveClose, rejectClose) =>
            activeServer.close((error) => (error ? rejectClose(error) : resolveClose())),
          ),
      );
    if (jobs) await closeResource("jobs-queue", () => jobs?.close() ?? Promise.resolve());
    const activeDatabase = database;
    if (activeDatabase) await closeResource("database", () => activeDatabase.close());
    if (telemetry)
      await closeResource("telemetry", () => telemetry?.shutdown() ?? Promise.resolve());
    if (failures.length) {
      logger.error("API server stopped with shutdown errors", {
        event: "api.shutdown.failed",
        failureCount: failures.length,
      });
    } else {
      logger.info("API server stopped", { event: "api.shutdown.completed" });
    }
    await closeResource("logging", () => shutdownLogging());
    if (failures.length)
      throw new AggregateError(failures, "One or more API shutdown steps failed");
  };
  try {
    telemetry = await startTelemetry({
      enabled: config.otelEnabled,
      endpoint: config.otelEndpoint,
      metricExportIntervalMillis: config.otelMetricExportInterval,
    });
    const databaseContext = createDatabase({
      databaseUrl: config.databaseRuntimeUrl,
      poolMax: config.databasePoolMax,
    });
    database = databaseContext;
    await assertDatabaseMigrations(databaseContext.db);
    const auth = createAuthModule({
      database: databaseContext.db,
      baseURL: config.betterAuthUrl,
      secret: config.betterAuthSecret,
      trustedOrigins: [config.webOrigin],
      securityEvents: {
        emit: async (event) => {
          logger.info("Authentication security event", { ...event });
        },
      },
      policy: createPermissionPolicy({
        roles: {
          owner: { todos: ["read", "write", "delete"] },
          admin: { todos: ["read", "write", "delete"] },
          member: { todos: ["read", "write"] },
        },
      }),
      openApiEnabled: config.apiDocsEnabled,
    });
    if (config.jobsEnabled) {
      try {
        jobs = await createBullMqJobs({
          databaseUrl: config.databaseRuntimeUrl,
          poolMax: config.jobsPoolMax,
          logger: getAppLogger(["api", "jobs"]),
        });
      } catch (error) {
        throw new Error(
          "Could not initialize BullMQ. Run `just infra-up` to provision database and jobs schemas.",
          { cause: error },
        );
      }
    }
    const todoService = createTodoService({ database: databaseContext.db });
    const app = createApp({
      logger,
      http: { webOrigin: config.webOrigin, apiOrigin: config.betterAuthUrl },
      environment: config.environment,
      csrfSecret: config.bullBoardCsrfSecret,
      documentation: { enabled: config.apiDocsEnabled },
      modules: {
        system: { checkDatabase: () => checkDatabase(databaseContext.db) },
        todos: { service: todoService },
        auth,
        ...(config.logStreamEnabled
          ? { logStream: { stream: logStream, heartbeatMs: config.logStreamHeartbeatMs } }
          : {}),
        ...(jobs
          ? {
              jobs: {
                producer: jobs.producer,
                board: jobs.board,
                boardEnabled: config.bullBoardEnabled,
                boardBasePath: config.bullBoardBasePath,
              },
            }
          : {}),
      },
      web: { ...(config.webAssetsDirectory ? { assetsDirectory: config.webAssetsDirectory } : {}) },
    });
    server = serve({ fetch: app.fetch, hostname: config.host, port: config.port });
    server.on("error", (error) => {
      logger.error("API HTTP server error", { event: "api.server.error", error });
    });
    await waitForListening(server);
    serverListening = true;
    logger.info("API server started", {
      event: "api.started",
      host: config.host,
      port: config.port,
    });
    return cleanup;
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      process.stderr.write(
        `API cleanup after startup failure also failed: ${String(cleanupError)}\n`,
      );
    }
    throw error;
  }
}
