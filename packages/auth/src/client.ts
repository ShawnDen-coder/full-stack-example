import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";

export function createAppAuthClient(options: { readonly baseURL: string }) {
  return createAuthClient({
    baseURL: options.baseURL,
    plugins: [organizationClient()],
  });
}
