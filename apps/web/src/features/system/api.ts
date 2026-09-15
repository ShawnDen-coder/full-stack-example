import type { SystemApiType } from "@full-stack-example/system";
import { hc } from "hono/client";
import { createApiClientOptions, getApiBaseUrl } from "../../lib/api-client-options.js";
import { throwApiError } from "../../lib/api-error.js";
export function createSystemApiClient(baseUrl: string, fetchImplementation?: typeof fetch) {
  return hc<SystemApiType>(baseUrl, createApiClientOptions(fetchImplementation));
}
export const systemApi = createSystemApiClient(getApiBaseUrl());

export async function getHealth() {
  const response = await systemApi.health.$get();
  if (response.status === 200 || response.status === 503) return response.json();
  return throwApiError(response);
}
