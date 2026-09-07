import { hc } from "hono/client";
import type { AppType } from "@full-stack-example/api/contract";

export function createApiClient(baseUrl: string) {
  return hc<AppType>(baseUrl, { init: { credentials: "include" } });
}
