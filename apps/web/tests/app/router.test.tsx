// @vitest-environment jsdom

import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter, router } from "../../src/app/router.js";
import { AppRouter } from "../../src/app/router-provider.js";
import { routeTree } from "../../src/app/routing/route-tree.js";
import { queryClient } from "../../src/lib/query-client.js";

const sessionState = vi.hoisted(() => ({
  current: { data: null, isPending: false },
}));

vi.mock("../../src/features/auth/client.js", () => ({
  authClient: { useSession: () => sessionState.current },
}));

afterEach(() => {
  sessionState.current = { data: null, isPending: false };
  window.history.replaceState({}, "", "/");
});

describe("application routes", () => {
  it("matches the home, authentication, workspace, and Todo routes", () => {
    expect(routeTree).toBeDefined();
    expect(routeTree.children?.length).toBeGreaterThan(0);
    expect(router.options.defaultPreload).toBe("intent");
    expect(router.options.defaultPreloadStaleTime).toBe(0);
    expect(router.options.scrollRestoration).toBe(true);
    expect(router.options.defaultPendingComponent).toBeDefined();
    expect(router.options.defaultErrorComponent).toBeDefined();
    expect(router.options.defaultNotFoundComponent).toBeDefined();
  });

  it("redirects anonymous Todo navigation to login with a safe return target", async () => {
    const testRouter = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/todos"] }),
    });

    await testRouter.load();

    expect(testRouter.state.location.pathname).toBe("/login");
    expect(testRouter.state.location.search.returnTo).toBe("/todos");
  });

  it("uses the workspace flow when an authenticated session has no active organization", async () => {
    const testRouter = createAppRouter({
      session: { session: { activeOrganizationId: null } } as never,
      history: createMemoryHistory({ initialEntries: ["/login?returnTo=%2Ftodos"] }),
    });

    await testRouter.load();

    expect(testRouter.state.location.pathname).toBe("/workspaces");
    expect(testRouter.state.location.search.returnTo).toBe("/todos");
  });

  it("renders the configured not-found state without changing the URL", async () => {
    const testRouter = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/does-not-exist"] }),
    });

    await testRouter.load();

    expect(testRouter.state.location.pathname).toBe("/does-not-exist");
    expect(testRouter.options.defaultNotFoundComponent).toBeDefined();
  });

  it("keeps the current route mounted while the session refreshes", async () => {
    await router.navigate({ to: "/login", search: { returnTo: "/todos" } });
    const view = render(
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>,
    );
    const email = await screen.findByLabelText("邮箱");
    fireEvent.change(email, { target: { value: "admin@example.com" } });

    sessionState.current = { data: null, isPending: true };
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>,
    );

    expect((screen.getByLabelText("邮箱") as HTMLInputElement).value).toBe("admin@example.com");
  });
});
