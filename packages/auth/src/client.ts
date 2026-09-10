import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

type AppAuthClient = ReturnType<
  typeof createAuthClient<{
    baseURL: string;
    fetchOptions?: RequestInit;
    plugins: [ReturnType<typeof organizationClient<object>>];
  }>
>;

export function createAppAuthClient(options: {
  readonly baseURL: string;
  readonly fetchOptions?: RequestInit;
}): AppAuthClient {
  return createAuthClient({
    baseURL: options.baseURL,
    fetchOptions: options.fetchOptions,
    plugins: [organizationClient()],
  });
}
