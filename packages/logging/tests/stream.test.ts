import { describe, expect, it } from "vitest";
import { createLogStream } from "../src/stream.js";

function record(properties: Record<string, unknown>) {
  return {
    timestamp: new Date("2026-01-01T00:00:00.000Z"),
    level: "info" as const,
    category: ["test"],
    message: ["event"],
    properties,
  } as never;
}

describe("log stream snapshots", () => {
  it("handles bigint, errors and circular values without invoking serializers", () => {
    const stream = createLogStream();
    const circular: Record<string, unknown> = { count: 1n, error: new Error("failed") };
    circular.self = circular;
    Object.defineProperty(circular, "getter", { get: () => { throw new Error("should not run"); } });

    stream.publish(record(circular));
    expect(stream.subscribe().replay.records[0]?.properties).toMatchObject({
      count: "1n",
      error: { name: "Error", message: "failed" },
      self: "[Circular]",
      getter: "[Unavailable]",
    });
  });

  it("rejects invalid capacities", () => {
    expect(() => createLogStream({ capacity: 0 })).toThrow("capacity");
    expect(() => createLogStream({ capacity: Number.NaN })).toThrow("capacity");
  });
});
