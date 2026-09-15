import type { AppSession } from "./client.js";

export function safeReturnTo(value: string | null): string {
  // 仅允许站内路径，避免登录后跳转到外部地址。
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



