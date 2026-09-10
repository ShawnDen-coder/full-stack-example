import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [TanStackRouterVite({ routesDirectory: "./src/routes" }), react(), tailwindcss()],
  resolve: {
    alias: {
      "@full-stack-example/api-client": fileURLToPath(
        new URL("../../packages/api-client/src/index.ts", import.meta.url),
      ),
    },
  },
});
