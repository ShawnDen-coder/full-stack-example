import { cp, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "@rspress/core";
import { pluginTypeDoc } from "@rspress/plugin-typedoc";
import mermaid from "rspress-plugin-mermaid";
import { sidebar } from "./scripts/content.ts";

const repository = "https://github.com/ShawnDen-coder/full-stack-example";
const docs = import.meta.dirname;

export default defineConfig({
	root: path.join(docs, "content"),
	outDir: path.join(docs, "doc_build"),
	base: process.env.DOCS_BASE ?? "/full-stack-example/",
	siteOrigin: "https://shawnden-coder.github.io",
	lang: "zh",
	route: { localeRedirect: "never" },
	title: "Full Stack Example",
	description: "运行、理解和扩展这个 TypeScript 全栈示例。",
	locales: [
		{ lang: "zh", label: "简体中文" },
		{
			lang: "en",
			label: "English",
			description:
				"Run, understand, and extend this TypeScript full-stack example.",
		},
	],
	globalStyles: path.join(docs, "styles/index.css"),
	themeConfig: {
		socialLinks: [{ icon: "github", mode: "link", content: repository }],
		enableContentAnimation: false,
		locales: [
			{
				lang: "zh",
				label: "简体中文",
				nav: [],
				sidebar: { "/": sidebar("zh") },
			},
			{
				lang: "en",
				label: "English",
				nav: [],
				sidebar: { "/en/": sidebar("en") },
			},
		],
	},
	plugins: [
		mermaid({
			mermaidConfig: {
				theme: "neutral",
				fontFamily: '"JetBrains Mono", "Sarasa Term SC", monospace',
			},
		}),
		pluginTypeDoc({
			entryPoints: [
				"packages/api/src/routers/index.ts",
				"packages/domain/src/todos/service.ts",
				"packages/domain/src/users/service.ts",
				"packages/db/src/index.ts",
				"packages/queue/src/index.ts",
				"packages/observability/src/index.ts",
			].map((file) => path.join(docs, "..", file)),
			outDir: "en/reference/typescript",
			setup(application) {
				application.options.setValue(
					"tsconfig",
					path.join(docs, "tsconfig.typedoc.json"),
				);
			},
		}),
		{
			name: "localized-typescript-reference",
			async config(config) {
				const reference = path.join(docs, "content/en/reference/typescript");
				const files = await readdir(reference, { recursive: true });
				for (const file of files.filter((file) => file.endsWith(".md"))) {
					const source = path.join(reference, file);
					const markdown = await readFile(source, "utf8");
					await writeFile(
						source,
						`---\noutline: false\nfooter: false\n---\n\n${markdown}`,
					);
				}
				await cp(
					reference,
					path.join(docs, "content/zh/reference/typescript"),
					{
						recursive: true,
					},
				);
				return config;
			},
		},
	],
});
