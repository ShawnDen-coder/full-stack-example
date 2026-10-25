import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { appRouter } from "@full-stack-example/api/routers/index";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { languages, pages, transformMarkdown } from "./content.ts";

const docs = path.resolve(import.meta.dirname, "..");
const root = path.resolve(docs, "..");
const content = path.join(docs, "content");
await rm(content, { recursive: true, force: true });

for (const language of languages) {
	for (const page of pages(language)) {
		const source = await readFile(path.join(root, page.source), "utf8");
		const markdown = transformMarkdown(source, page.source, root);
		const output = path.join(content, language, page.route, "index.md");
		await mkdir(path.dirname(output), { recursive: true });
		await writeFile(
			output,
			`---\noutline: false\nfooter: false\n---\n\n${markdown}`,
		);
	}
	const target = path.join(content, language, "reference/http-api/index.mdx");
	await mkdir(path.dirname(target), { recursive: true });
	const introduction =
		language === "zh"
			? "规范从当前 oRPC router 生成。Todo 与 users 操作需要登录；认证会话由运行中的应用提供。静态站提供接口查阅与规范下载。"
			: "Generated from the current oRPC router. Todo and users operations require an authenticated application session. This static site provides reference browsing and a downloadable specification.";
	await writeFile(
		target,
		`---\noutline: false\nfooter: false\n---\n\nimport { OpenApiReference } from "../../../../components/OpenApiReference";\n\n# HTTP API\n\n${introduction}\n\n<OpenApiReference />\n`,
	);
}

const generator = new OpenAPIGenerator({
	schemaConverters: [new ZodToJsonSchemaConverter()],
});
const spec = await generator.generate(appRouter, {
	info: { title: "Full Stack Example", version: "development" },
});
if (!spec.paths || Object.keys(spec.paths).length === 0)
	throw new Error("OpenAPI generation produced no paths");
const publicDirectory = path.join(content, "public/generated");
await mkdir(publicDirectory, { recursive: true });
await writeFile(
	path.join(publicDirectory, "openapi.json"),
	`${JSON.stringify(spec, null, 2)}\n`,
);
console.log(
	`Generated ${languages.length * pages("zh").length} documentation pages and the current OpenAPI specification.`,
);
