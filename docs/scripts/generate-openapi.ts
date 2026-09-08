import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validate } from "@scalar/openapi-parser";
import { createApp } from "../../apps/api/src/app.js";
import { configureLogging, getAppLogger } from "../../packages/logging/src/logger.js";
import type { TodoService } from "../../packages/todos/src/service.js";

const todoService: TodoService = {
  listTodos: async () => [],
  createTodo: async (input) => ({ id: 1, title: input.title, completed: false }),
  updateTodo: async ({ id, completed }) => ({ id, title: "Example", completed }),
  deleteTodo: async () => true,
};

await configureLogging({ service: "docs", environment: "test", level: "silent", pretty: false });
const app = createApp({
  checkDatabase: async () => undefined,
  logger: getAppLogger("docs.openapi"),
  todoService,
  webOrigin: "http://localhost:5173",
});
const response = await app.request("http://localhost/openapi.json");
if (response.status !== 200) throw new Error(`OpenAPI endpoint returned ${response.status}`);
if (!response.headers.get("content-type")?.includes("application/json")) {
  throw new Error("OpenAPI endpoint did not return JSON");
}
const document = (await response.json()) as { openapi?: unknown; paths?: unknown };
if (document.openapi !== "3.1.0" || !document.paths) {
  throw new Error("Generated OpenAPI document is missing OpenAPI 3.1 metadata or paths");
}
const validation = await validate(document);
if (!validation.valid)
  throw new Error(`OpenAPI validation failed: ${JSON.stringify(validation.errors)}`);

const output = path.join(import.meta.dirname, "..", "public", "generated", "openapi.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, "utf8");
console.log(`Generated ${path.relative(process.cwd(), output)}`);
