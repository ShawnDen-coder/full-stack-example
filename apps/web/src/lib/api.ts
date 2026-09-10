import type { AppType } from "@full-stack-example/api/contract";
import { createApiClient } from "@full-stack-example/api-client";
import { resolveApiBaseUrl } from "./api-base-url.js";

export const api = createApiClient<AppType>(
  resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, globalThis.location.origin),
  { init: { credentials: "include" } },
);
