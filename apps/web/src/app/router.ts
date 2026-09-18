import type { QueryClient } from "@tanstack/react-query";
import { createBrowserHistory, createRouter, type RouterHistory } from "@tanstack/react-router";
import type { AppSession } from "../features/auth/client.js";
import { queryClient as defaultQueryClient } from "../lib/query-client.js";
import { RouteError, RouteNotFound, RoutePending } from "./routing/root-route.js";
import { routeTree } from "./routing/route-tree.js";

export type AppRouterOptions = {
  readonly history?: RouterHistory;
  readonly session?: AppSession | null;
  readonly queryClient?: QueryClient;
};

export function createAppRouter(options: AppRouterOptions = {}) {
  return createRouter({
    routeTree,
    history: options.history ?? createBrowserHistory(),
    context: {
      session: options.session ?? null,
      queryClient: options.queryClient ?? defaultQueryClient,
    },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingComponent: RoutePending,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
  });
}

export const router = createAppRouter();

export type AppRoutePath = NonNullable<Parameters<typeof router.navigate>[0]["to"]>;

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
