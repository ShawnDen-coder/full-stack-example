import { describe, expect, it, vi } from "vitest";
import { createSystemApiClient } from "../src/features/system/api.js";
import { createTodosApiClient } from "../src/features/todos/api.js";

describe("feature RPC clients", () => {
  it("creates feature-scoped clients that include browser credentials", async () => {
    const fetch = vi.fn(async () => new Response("{}"));
    const systemApi = createSystemApiClient("https://example.test", fetch);
    const todosApi = createTodosApiClient("https://example.test", fetch);

    await systemApi.health.$get();
    await todosApi.todos.$get();

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://example.test/health",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://example.test/api/todos",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
