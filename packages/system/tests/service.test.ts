import { afterEach, describe, expect, it, vi } from "vitest";
import { getHealth } from "../src/service.js";

afterEach(() => vi.useRealTimers());

describe("getHealth", () => {
  it.each([false, true])("clears the deadline after a settled probe (fails=%s)", async (fails) => {
    vi.useFakeTimers();
    await getHealth(async () => {
      if (fails) throw new Error("down");
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a stalled database as down at the deadline", async () => {
    vi.useFakeTimers();
    const result = getHealth(() => new Promise(() => {}), 50);
    await vi.advanceTimersByTimeAsync(50);
    expect(await result).toMatchObject({
      status: "degraded",
      services: { database: { status: "down" } },
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("reports an available database", async () => {
    await expect(getHealth(async () => undefined)).resolves.toMatchObject({
      status: "ok",
      services: { database: { status: "up" } },
    });
  });

  it("does not expose database errors", async () => {
    const result = await getHealth(async () => {
      throw new Error("credential secret");
    });
    expect(result).toMatchObject({
      status: "degraded",
      services: { database: { status: "down" } },
    });
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
    expect(JSON.stringify(result)).not.toContain("credential secret");
  });
});
