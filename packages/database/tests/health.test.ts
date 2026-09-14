import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../src/client.js";
import {
  assertDatabaseMigrations,
  DatabaseMigrationRequiredError,
  REQUIRED_DATABASE_MIGRATION_VERSION,
} from "../src/health.js";

function createDatabaseStub(result: readonly { readonly createdAt?: unknown }[]) {
  return { execute: vi.fn().mockResolvedValue(result) } as unknown as Database;
}

describe("database migration readiness", () => {
  it("accepts a journal at the required version or newer", async () => {
    await expect(
      assertDatabaseMigrations(
        createDatabaseStub([{ createdAt: REQUIRED_DATABASE_MIGRATION_VERSION }]),
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertDatabaseMigrations(
        createDatabaseStub([{ createdAt: REQUIRED_DATABASE_MIGRATION_VERSION + 1 }]),
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    { result: [] },
    { result: [{}] },
    { result: [{ createdAt: REQUIRED_DATABASE_MIGRATION_VERSION - 1 }] },
  ])("rejects an empty, malformed, or out-of-date journal", async ({ result }) => {
    await expect(assertDatabaseMigrations(createDatabaseStub(result))).rejects.toBeInstanceOf(
      DatabaseMigrationRequiredError,
    );
  });

  it.each(["3F000", "42P01", "42501"])(
    "normalizes journal schema, table, or permission error %s",
    async (code) => {
      const cause = Object.assign(new Error("database error"), { code });
      const db = { execute: vi.fn().mockRejectedValue(cause) } as unknown as Database;
      await expect(assertDatabaseMigrations(db)).rejects.toMatchObject({
        name: "DatabaseMigrationRequiredError",
        cause,
      });
    },
  );

  it("preserves unrelated database errors", async () => {
    const connectionError = Object.assign(new Error("connection refused"), {
      code: "ECONNREFUSED",
    });
    const db = { execute: vi.fn().mockRejectedValue(connectionError) } as unknown as Database;
    await expect(assertDatabaseMigrations(db)).rejects.toBe(connectionError);
  });

  it("keeps the required version aligned with the latest Drizzle journal entry", async () => {
    const journal = JSON.parse(
      await readFile(new URL("../migrations/meta/_journal.json", import.meta.url), "utf8"),
    ) as { readonly entries: readonly { readonly when: number }[] };
    const latest = Math.max(...journal.entries.map((entry) => entry.when));
    expect(REQUIRED_DATABASE_MIGRATION_VERSION).toBe(latest);
  });
});
