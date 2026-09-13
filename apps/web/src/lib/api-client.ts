import type { SystemApiType } from "@full-stack-example/system";
import type { TodosApiType } from "@full-stack-example/todos";
import { hc } from "hono/client";
import { resolveApiBaseUrl } from "./api-base-url.js";

export function createApiClients(baseUrl: string, fetchImplementation?: typeof fetch) {
  const options = {
    init: { credentials: "include" as const },
    ...(fetchImplementation ? { fetch: fetchImplementation } : {}),
  };
  return {
    systemApi: hc<SystemApiType>(baseUrl, options),
    todosApi: hc<TodosApiType>(baseUrl, options),
  };
}

const fallbackOrigin =
  typeof globalThis.location === "undefined" ? "http://localhost:3000" : globalThis.location.origin;

export const { systemApi, todosApi } = createApiClients(
  resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, fallbackOrigin),
);
