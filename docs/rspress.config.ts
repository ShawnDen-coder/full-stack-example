import path from "node:path";
import { defineConfig } from "@rspress/core";
import { pluginLlms } from "@rspress/plugin-llms";
import { pluginSitemap } from "@rspress/plugin-sitemap";
import { pluginTypeDoc } from "@rspress/plugin-typedoc";

const repository = "https://github.com/ShawnDen-coder/full-stack-example";
const base = process.env.DOCS_BASE ?? "/";
const siteOrigin = process.env.DOCS_SITE_ORIGIN ?? "https://shawnden-coder.github.io";

export default defineConfig({
  root: path.join(import.meta.dirname, "content"),
  outDir: path.join(import.meta.dirname, "doc_build"),
  base,
  siteOrigin,
  lang: "zh-CN",
  title: "Full Stack Example",
  description: "Full Stack Example 的架构、开发指南、模块说明与 API Reference。",
  themeConfig: {
    socialLinks: [{ icon: "github", mode: "link", content: repository }],
    footer: { message: "Built with Rspress" },
  },
  plugins: [
    pluginLlms(),
    pluginSitemap({ siteUrl: `${siteOrigin}${base}` }),
    pluginTypeDoc({
      entryPoints: [
        path.join(import.meta.dirname, "..", "packages", "api-client", "src", "index.ts"),
        path.join(import.meta.dirname, "..", "packages", "todos", "src", "index.ts"),
        path.join(import.meta.dirname, "..", "packages", "system", "src", "index.ts"),
        path.join(import.meta.dirname, "..", "packages", "database", "src", "index.ts"),
        path.join(import.meta.dirname, "..", "packages", "logging", "src", "index.ts"),
      ],
      outDir: "reference/typescript",
      setup: (application) => {
        application.options.setValue(
          "tsconfig",
          "tsconfig.typedoc.json",
        );
      },
    }),
  ],
});
