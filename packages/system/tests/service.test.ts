import { describe, expect, it } from "vitest";
import { getHealth } from "../src/service.js";

describe("getHealth", () => {
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
