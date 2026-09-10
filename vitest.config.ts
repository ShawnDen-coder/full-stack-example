import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  test: {
    include: ["apps/*/tests/**/*.test.{ts,tsx}", "packages/*/tests/**/*.test.{ts,tsx}"],
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
      "@full-stack-example/todos": resolve(
        fileURLToPath(new URL(".", import.meta.url)),
        "packages/todos/src/index.ts",
      ),
      "@full-stack-example/api-client": resolve(
        fileURLToPath(new URL(".", import.meta.url)),
        "packages/api-client/src/index.ts",
      ),
      "@full-stack-example/auth/client": resolve(
        fileURLToPath(new URL(".", import.meta.url)),
        "packages/auth/src/client.ts",
      ),
      "@full-stack-example/auth/server": resolve(
        fileURLToPath(new URL(".", import.meta.url)),
        "packages/auth/src/server.ts",
      ),
      "@full-stack-example/api/contract": resolve(
        fileURLToPath(new URL(".", import.meta.url)),
        "apps/api/src/contract.ts",
      ),
    },
  },
});
