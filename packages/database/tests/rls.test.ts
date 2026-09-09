import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("tenant RLS migration", () => {
  it("enforces deny-by-default tenant policy", async () => {
    const migration = await readFile(
      new URL("../migrations/0005_tenant_todos.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain('ALTER TABLE "todos" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("current_setting('app.tenant_id', true)");
    expect(migration).toContain("without tenant_id");
    expect(migration).not.toContain('ALTER TABLE "user" ENABLE ROW LEVEL SECURITY');
    expect(migration).not.toContain('ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY');
  });
});
