import { describe, expect, it, vi } from "vitest";
import { performSignOut } from "../../../src/features/auth/sign-out.js";

function createActions(signOutResult: { error?: unknown | null }) {
  const events: string[] = [];
  return {
    events,
    actions: {
      requestSignOut: vi.fn(async () => {
        events.push("request");
        return signOutResult;
      }),
      clearTenantQueries: vi.fn(async () => {
        events.push("clear");
      }),
      refreshSession: vi.fn(async () => {
        events.push("session");
      }),
      invalidateRouter: vi.fn(async () => {
        events.push("invalidate");
      }),
      navigateToLogin: vi.fn(async () => {
        events.push("navigate");
      }),
    },
  };
}

describe("performSignOut", () => {
  it("clears tenant data, refreshes auth state, and navigates after success", async () => {
    const { actions, events } = createActions({ error: null });

    await expect(performSignOut(actions)).resolves.toBe(true);
    expect(events).toEqual(["request", "clear", "session", "invalidate", "navigate"]);
  });

  it("does not clear cache or navigate when the sign-out request fails", async () => {
    const { actions, events } = createActions({ error: new Error("network failure") });

    await expect(performSignOut(actions)).resolves.toBe(false);
    expect(events).toEqual(["request"]);
    expect(actions.clearTenantQueries).not.toHaveBeenCalled();
    expect(actions.navigateToLogin).not.toHaveBeenCalled();
  });

  it("does not clear cache or navigate when the sign-out request throws", async () => {
    const { actions, events } = createActions({ error: null });
    actions.requestSignOut.mockRejectedValueOnce(new Error("network failure"));

    await expect(performSignOut(actions)).resolves.toBe(false);
    expect(events).toEqual([]);
    expect(actions.clearTenantQueries).not.toHaveBeenCalled();
    expect(actions.navigateToLogin).not.toHaveBeenCalled();
  });
});

