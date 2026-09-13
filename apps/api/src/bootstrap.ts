import { createAuthModule, createPermissionPolicy } from "@full-stack-example/auth/server";
import { checkDatabase, createDatabase } from "@full-stack-example/database";
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
  let jobs: Awaited<ReturnType<typeof createBullMqJobs>> | undefined;
  let closed = false;
  const cleanup = async () => {
    if (closed) return;
    closed = true;
    const activeServer = server;
    if (activeServer)
      await new Promise<void>((resolveClose, rejectClose) =>
        activeServer.close((error) => (error ? rejectClose(error) : resolveClose())),
      );
    if (jobs) await jobs.close();
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
    if (config.jobsEnabled) {
      jobs = await createBullMqJobs({
        databaseUrl: config.databaseRuntimeUrl,
        poolMax: config.jobsPoolMax,
        logger: getAppLogger(["api", "jobs"]),
      });
    }
    const databaseContext = createDatabase({
      databaseUrl: config.databaseRuntimeUrl,
      poolMax: config.databasePoolMax,
    });
    database = databaseContext;
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
    if (config.platformAdmin) {
      const admin = await auth.ensurePlatformAdmin(config.platformAdmin);
      logger.info("Platform admin is ready", {
        event: "auth.platform_admin.ready",
        userId: admin.id,
        created: admin.created,
      });
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
                service: jobs.service,
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
