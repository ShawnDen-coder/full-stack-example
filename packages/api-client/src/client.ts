import type { Hono } from "hono";
import { type ClientRequestOptions, hc } from "hono/client";

export type ApiClient<TApp extends Hono<any, any, any>> = ReturnType<typeof hc<TApp>>;

/**
 * Create a typed Hono client for a contract supplied by the consuming app.
 * Authentication and transport policy are intentionally owned by that app.
 */
export function createApiClient<TApp extends Hono<any, any, any>>(
  baseUrl: string,
  options?: ClientRequestOptions,
): ApiClient<TApp> {
  return hc<TApp>(baseUrl, options);
}
