import { createAppAuthClient } from "@full-stack-example/auth/client";
import { resolveApiBaseUrl } from "./api-base-url.js";

export const authClient = createAppAuthClient({
  baseURL: resolveApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
    globalThis.location?.origin ?? "http://localhost",
  ),
  fetchOptions: { credentials: "include" },
});

export function safeReturnTo(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/todos";
  return value;
}

export function activeOrganizationId(session: unknown): string | undefined {
  if (!session || typeof session !== "object" || !("session" in session)) return undefined;
  const value = (session as { readonly session?: { readonly activeOrganizationId?: unknown } })
    .session?.activeOrganizationId;
  return typeof value === "string" ? value : undefined;
}
