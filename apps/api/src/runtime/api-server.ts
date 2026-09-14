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
import { createApp } from "../app/create-app.js";
import type { ApiEnvironment } from "../config/api.js";
import { waitForListening } from "./listen.js";
import { startTelemetry } from "./telemetry.js";

export interface ApiServerRuntime {
  close(): Promise<void>;
}

export async function startApiServer(environment: ApiEnvironment): Promise<ApiServerRuntime> {
  const logStream = createLogStream({ capacity: environment.LOG_STREAM_BUFFER_SIZE });
  await configureLogging({
    service: "api",
    environment: environment.NODE_ENV,
    level: environment.LOG_LEVEL,
    pretty: environment.LOG_PRETTY,
    stream: logStream,
    ...(environment.LOG_FILE ? { filePath: environment.LOG_FILE } : {}),
  });
  const logger = getAppLogger(["api", "server"]);
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
      enabled: environment.OTEL_ENABLED,
      endpoint: environment.OTEL_EXPORTER_OTLP_ENDPOINT,
      metricExportIntervalMillis: environment.OTEL_METRIC_EXPORT_INTERVAL,
    });
    const databaseContext = createDatabase({
      databaseUrl: environment.DATABASE_RUNTIME_URL,
      poolMax: environment.DATABASE_POOL_MAX,
    });
    database = databaseContext;
    await assertDatabaseMigrations(databaseContext.db);
    const auth = createAuthModule({
      database: databaseContext.db,
      baseURL: environment.BETTER_AUTH_URL,
      secret: environment.BETTER_AUTH_SECRET,
      trustedOrigins: [environment.WEB_ORIGIN],
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
      openApiEnabled: environment.API_DOCS_ENABLED,
    });
    if (environment.JOBS_ENABLED) {
      try {
        jobs = await createBullMqJobs({
          databaseUrl: environment.DATABASE_RUNTIME_URL,
          poolMax: environment.JOBS_POOL_MAX,
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
      http: { webOrigin: environment.WEB_ORIGIN, apiOrigin: environment.BETTER_AUTH_URL },
      services: {
        auth,
        system: { checkDatabase: () => checkDatabase(databaseContext.db) },
        todos: todoService,
      },
      features: {
        documentation: { enabled: environment.API_DOCS_ENABLED },
        web: {
          ...(environment.WEB_ASSETS_DIR ? { assetsDirectory: environment.WEB_ASSETS_DIR } : {}),
        },
        ...(environment.LOG_STREAM_ENABLED
          ? { logStream: { stream: logStream, heartbeatMs: environment.LOG_STREAM_HEARTBEAT_MS } }
          : {}),
        ...(jobs ? { jobsAdmin: { producer: jobs.producer } } : {}),
        ...(jobs && environment.BULL_BOARD_ENABLED
          ? {
              jobsBoard: {
                source: jobs.board,
                basePath: environment.BULL_BOARD_BASE_PATH,
                environment: environment.NODE_ENV,
                csrfSecret: environment.BULL_BOARD_CSRF_SECRET,
                allowedOrigins: [environment.WEB_ORIGIN, environment.BETTER_AUTH_URL],
              },
            }
          : {}),
      },
    });
    server = serve({ fetch: app.fetch, hostname: environment.HOST, port: environment.PORT });
    server.on("error", (error) => {
      logger.error("API HTTP server error", { event: "api.server.error", error });
    });
    await waitForListening(server);
    serverListening = true;
    logger.info("API server started", {
      event: "api.started",
      host: environment.HOST,
      port: environment.PORT,
    });
    return { close: cleanup };
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
