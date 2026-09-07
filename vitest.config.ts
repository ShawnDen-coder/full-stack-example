import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@full-stack-example/database": resolve(
        fileURLToPath(new URL(".", import.meta.url)),
        "packages/database/src/index.ts",
      ),
      "@full-stack-example/logging": resolve(
        fileURLToPath(new URL(".", import.meta.url)),
        "packages/logging/src/index.ts",
      ),
      "@full-stack-example/system": resolve(
        fileURLToPath(new URL(".", import.meta.url)),
        "packages/system/src/index.ts",
      ),
      "@full-stack-example/api-client": resolve(
        fileURLToPath(new URL(".", import.meta.url)),
        "packages/api-client/src/index.ts",
      ),
      "@full-stack-example/api/contract": resolve(
        fileURLToPath(new URL(".", import.meta.url)),
        "apps/api/src/contract.ts",
      ),
    },
  },
});
