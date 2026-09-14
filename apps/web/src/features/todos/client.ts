import type { TodosApiType } from "@full-stack-example/todos";
import { hc } from "hono/client";
import { createApiClientOptions, getApiBaseUrl } from "../../lib/api-client-options.js";

export function createTodosApiClient(baseUrl: string, fetchImplementation?: typeof fetch) {
  return hc<TodosApiType>(
    `${baseUrl.replace(/\/$/, "")}/api`,
    createApiClientOptions(fetchImplementation),
  );
}

export const todosApi = createTodosApiClient(getApiBaseUrl());
