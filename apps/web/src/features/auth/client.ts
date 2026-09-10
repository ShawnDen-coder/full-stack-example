import { createAppAuthClient } from "@full-stack-example/auth/client";
import { resolveApiBaseUrl } from "../../lib/api-base-url.js";

export const authClient = createAppAuthClient({
  baseURL: resolveApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
    globalThis.location?.origin ?? "http://localhost",
  ),
  fetchOptions: { credentials: "include" },
});

export type AppSession = NonNullable<ReturnType<typeof authClient.useSession>["data"]>;
