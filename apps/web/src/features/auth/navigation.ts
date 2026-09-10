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
