export function createApiClientOptions(fetchImplementation?: typeof fetch) {
  return {
    init: { credentials: "include" as const },
    ...(fetchImplementation ? { fetch: fetchImplementation } : {}),
  };
}

export function getApiBaseUrl() {
  const fallbackOrigin =
    typeof globalThis.location === "undefined"
      ? "http://localhost:3000"
      : globalThis.location.origin;
  return import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
    : fallbackOrigin;
}



