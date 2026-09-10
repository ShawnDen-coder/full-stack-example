export function resolveApiBaseUrl(value: string | undefined, fallbackOrigin: string): string {
  if (!value) return fallbackOrigin;
  return value.replace(/\/$/, "");
}
