import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/client.js";

describe("database client configuration", () => {
  it("rejects an invalid connection pool maximum before opening a connection", () => {
    expect(() =>
      createDatabase({ databaseUrl: "postgres://user:pass@localhost/db", poolMax: 0 }),
    ).toThrow("poolMax must be a positive integer");
  });
});
