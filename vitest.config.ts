import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  test: {
    include: ["apps/*/tests/**/*.test.ts", "packages/*/tests/**/*.test.ts"],
    exclude: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
  },
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
