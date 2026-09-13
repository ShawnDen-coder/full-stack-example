import type { SystemApiType } from "@full-stack-example/system";
import { hc } from "hono/client";
import { createApiClientOptions, getApiBaseUrl } from "../../lib/api-client-options.js";

export function createSystemApiClient(baseUrl: string, fetchImplementation?: typeof fetch) {
  return hc<SystemApiType>(baseUrl, createApiClientOptions(fetchImplementation));
}

export const systemApi = createSystemApiClient(getApiBaseUrl());
