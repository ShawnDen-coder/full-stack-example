import { describe, expect, it, vi } from "vitest";
import { createTodoService } from "../src/index.js";

describe("Tenant Todo service", () => {
  it("rejects an empty tenant before opening a transaction", async () => {
    const transaction = vi.fn();
    const service = createTodoService({ database: { transaction } as any });

    await expect(service.listTodos("")).rejects.toThrow("tenantId is required");
    expect(transaction).not.toHaveBeenCalled();
  });
});
