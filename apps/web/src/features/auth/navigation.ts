import type { AppSession } from "./client.js";

export function safeReturnTo(value: string | null): string {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/login") ||
    value.startsWith("/register")
  )
    return "/todos";
  return value;
}

export function validateReturnToSearch(search: Record<string, unknown>) {
  return { returnTo: safeReturnTo(typeof search.returnTo === "string" ? search.returnTo : null) };
}

export function activeOrganizationId(session: AppSession | null): string | undefined {
  return session?.session.activeOrganizationId ?? undefined;
}
