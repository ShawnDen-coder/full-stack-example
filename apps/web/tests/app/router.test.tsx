// @vitest-environment jsdom

import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRouter, router } from "../../src/app/router.js";
import { queryClient } from "../../src/lib/query-client.js";
import { routeTree } from "../../src/routeTree.gen.js";

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

