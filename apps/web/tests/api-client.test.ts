import { describe, expect, it, vi } from "vitest";
import { createApiClients } from "../src/lib/api-client.js";

describe("createApiClients", () => {
  it("creates feature-scoped clients that include browser credentials", async () => {
    const fetch = vi.fn(async () => new Response("{}"));
    const { systemApi, todosApi } = createApiClients("https://example.test", fetch);

    await systemApi.health.$get();
    await todosApi.api.todos.$get();

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
