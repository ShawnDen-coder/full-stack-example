// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "../../src/routes/index.js";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../src/features/auth/client.js", () => ({
  authClient: { useSession: () => ({ data: { user: { email: "user@example.test" } } }) },
}));

afterEach(() => vi.unstubAllGlobals());

describe("HomePage", () => {
  it("links signed-in users to the Todo page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> =>
          new Response(
            JSON.stringify({
              status: "ok",
              services: { database: { status: "up" } },
              timestamp: "2026-09-07T00:00:00.000Z",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <HomePage />
      </QueryClientProvider>,
    );

    const link = await screen.findByRole("link", { name: "打开 Todo" });
    expect(link instanceof HTMLAnchorElement && link.pathname).toBe("/todos");
  });
});
