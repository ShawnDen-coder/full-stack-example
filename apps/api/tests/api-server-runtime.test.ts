import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const logger = { error: vi.fn(), info: vi.fn(), getChild: vi.fn() };
  const database = { db: {}, close: vi.fn(async () => {}) };
  const jobs = { producer: {}, board: {}, close: vi.fn(async () => {}) };
  const telemetry = { shutdown: vi.fn(async () => {}) };
  const server = {
    on: vi.fn(),
    close: vi.fn((callback?: (error?: Error) => void) => callback?.()),
  };
  return {
    logger,
    database,
    jobs,
    telemetry,
    server,
    configureLogging: vi.fn(async () => {}),
    createBullMqJobs: vi.fn(async () => jobs),
    createDatabase: vi.fn(() => database),
    createLogStream: vi.fn(() => ({})),
    createTodoService: vi.fn(() => ({})),
    getAppLogger: vi.fn(() => logger),
    serve: vi.fn(() => server),
    shutdownLogging: vi.fn(async () => {}),
    startTelemetry: vi.fn(async () => telemetry),
    waitForListening: vi.fn(async () => {}),
  };
});

vi.mock("@full-stack-example/auth/server", () => ({
  createAuthModule: vi.fn(() => ({})),
  createPermissionPolicy: vi.fn(() => ({})),
}));
vi.mock("@full-stack-example/database", () => ({
  assertDatabaseMigrations: vi.fn(async () => {}),
  checkDatabase: vi.fn(async () => {}),
  createDatabase: mocks.createDatabase,
}));
vi.mock("@full-stack-example/jobs/server", () => ({ createBullMqJobs: mocks.createBullMqJobs }));
vi.mock("@full-stack-example/logging", () => ({
  configureLogging: mocks.configureLogging,
  createLogStream: mocks.createLogStream,
  getAppLogger: mocks.getAppLogger,
  shutdownLogging: mocks.shutdownLogging,
}));
vi.mock("@full-stack-example/todos", () => ({ createTodoService: mocks.createTodoService }));
vi.mock("@hono/node-server", () => ({ serve: mocks.serve }));
vi.mock("../src/app/create-app.js", () => ({ createApp: vi.fn(() => ({ fetch: vi.fn() })) }));
vi.mock("../src/runtime/listen.js", () => ({ waitForListening: mocks.waitForListening }));
vi.mock("../src/runtime/telemetry.js", () => ({ startTelemetry: mocks.startTelemetry }));

import { parseApiEnvironment } from "../src/config/api.js";
import { startApiServer } from "../src/runtime/api-server.js";

describe("API server runtime", () => {
  const originalRuntimeUrl = process.env.DATABASE_RUNTIME_URL;
  const originalAuthSecret = process.env.BETTER_AUTH_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalRuntimeUrl === undefined) delete process.env.DATABASE_RUNTIME_URL;
    else process.env.DATABASE_RUNTIME_URL = originalRuntimeUrl;
    if (originalAuthSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = originalAuthSecret;
  });

  it("uses the validated environment passed by the entrypoint", async () => {
    process.env.DATABASE_RUNTIME_URL = "invalid ambient database URL";
    process.env.BETTER_AUTH_SECRET = "invalid ambient secret";
    const environment = parseApiEnvironment({
      DATABASE_RUNTIME_URL: "postgres://runtime:secret@runtime-host:5432/app",
      BETTER_AUTH_SECRET: "validated-secret-that-is-long-enough-for-the-test",
      HOST: "127.0.0.2",
      PORT: "4321",
    });

    const runtime = await startApiServer(environment);

    expect(mocks.createDatabase).toHaveBeenCalledWith({
      databaseUrl: "postgres://runtime:secret@runtime-host:5432/app",
      poolMax: 10,
    });
    expect(mocks.serve).toHaveBeenCalledWith({
      fetch: expect.any(Function),
      hostname: "127.0.0.2",
      port: 4321,
    });
    await runtime.close();
  });
});
