import { describe, expect, it, vi } from "vitest";
import { withTenantTransaction } from "../src/tenant.js";

describe("withTenantTransaction", () => {
  it("sets a transaction-local tenant context before repository work", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const transaction = vi.fn(async (work: (tx: { execute: typeof execute }) => Promise<unknown>) =>
      work({ execute }),
    );
    const database = { transaction } as any;
    await withTenantTransaction(database, "tenant-a", async () => "ok");
    expect(execute).toHaveBeenCalledOnce();
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("rejects an empty tenant id", async () => {
    await expect(withTenantTransaction({} as any, "", async () => undefined)).rejects.toThrow(
      "tenantId is required",
    );
  });
});
