import { hc } from "hono/client";
import type { AppType } from "@full-stack-example/api/contract";

export type ApiClient = ReturnType<typeof hc<AppType>>;

export function createApiClient(baseUrl: string): ApiClient {
  return hc<AppType>(baseUrl, { init: { credentials: "include" } });
}
