import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadWorkspaceEnvironment } from "../src/runtime/environment.js";

const testVariable = "FULL_STACK_API_ENVIRONMENT_TEST";
const originalTestVariable = process.env[testVariable];

afterEach(() => {
  if (originalTestVariable === undefined) delete process.env[testVariable];
  else process.env[testVariable] = originalTestVariable;
});

describe("workspace environment loading", () => {
  it("loads the supplied environment file through the shared entrypoint helper", async () => {
    const directory = await mkdtemp(join(tmpdir(), "api-environment-test-"));
    const environmentFile = join(directory, ".env");
    try {
      await writeFile(environmentFile, `${testVariable}=loaded\n`, "utf8");
      loadWorkspaceEnvironment(environmentFile);
      expect(process.env[testVariable]).toBe("loaded");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does nothing when the environment file does not exist", () => {
    expect(() => loadWorkspaceEnvironment(join(tmpdir(), "missing-api-test.env"))).not.toThrow();
  });
});
