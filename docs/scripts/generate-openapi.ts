import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validate } from "@scalar/openapi-parser";
import { createApp } from "../../apps/api/src/app.js";
import { createAuthModule } from "../../packages/auth/src/server.js";
import { createDatabase } from "../../packages/database/src/index.js";
import {
  configureLogging,
  createLogStream,
  getAppLogger,
} from "../../packages/logging/src/logger.js";
import type { TenantTodoService } from "../../packages/todos/src/service.js";

const todoService: TenantTodoService = {
  listTodos: async () => [],
  createTodo: async (_tenantId, input) => ({ id: 1, title: input.title, completed: false }),
  updateTodo: async (_tenantId, { id, completed }) => ({ id, title: "Example", completed }),
  deleteTodo: async () => true,
};

await configureLogging({ service: "docs", environment: "test", level: "silent", pretty: false });
// postgres.js connects lazily; documentation generation only reads Drizzle schema metadata.
const database = createDatabase({ databaseUrl: "postgres://docs:docs@127.0.0.1:5432/docs" });
const auth = createAuthModule({
  database: database.db,
  baseURL: "http://localhost:3000",
  secret: "documentation-only-secret-at-least-32-characters",
  trustedOrigins: ["http://localhost:5173"],
  openApiEnabled: true,
});
const app = createApp({
  logger: getAppLogger("docs.openapi"),
  http: { webOrigin: "http://localhost:5173" },
  documentation: { enabled: true },
  modules: {
    system: { checkDatabase: async () => undefined },
    todos: { service: todoService },
    auth,
    logStream: { stream: createLogStream() },
  },
  web: {},
});
const response = await app.request("http://localhost/openapi.json");
if (response.status !== 200) throw new Error(`OpenAPI endpoint returned ${response.status}`);
if (!response.headers.get("content-type")?.includes("application/json")) {
  throw new Error("OpenAPI endpoint did not return JSON");
}
const document = (await response.json()) as {
  openapi?: unknown;
  paths?: Record<string, unknown>;
};
if (document.openapi !== "3.1.0" || !document.paths) {
  throw new Error("Generated OpenAPI document is missing OpenAPI 3.1 metadata or paths");
}
const requiredPaths = [
  "/health",
  "/api/auth/sign-in/email",
  "/api/auth/organization/set-active",
  "/api/platform/users",
  "/api/todos",
  "/api/logs/stream",
] as const;
for (const requiredPath of requiredPaths) {
  if (!(requiredPath in document.paths))
    throw new Error(`Generated OpenAPI document is missing ${requiredPath}`);
}
const validation = await validate(document);
if (!validation.valid)
  throw new Error(`OpenAPI validation failed: ${JSON.stringify(validation.errors)}`);

const output = path.join(import.meta.dirname, "..", "public", "generated", "openapi.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, "utf8");
await database.close();
console.log(`Generated ${path.relative(process.cwd(), output)}`);
