import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("../doc_build/", import.meta.url));
const base = process.env.DOCS_BASE ?? "/full-stack-example/";
assert.ok(
	base.startsWith("/") && base.endsWith("/"),
	"DOCS_BASE must start and end with /",
);

const aliases = {
	"guide/": "/",
	"guide/getting-started/": "/#快速开始",
	"guide/project-overview/": "/",
	"guide/configuration/": "/guide/development/#环境配置",
	"guide/testing/": "/guide/contributing/#验证",
	"architecture/": "/guide/development/",
	"architecture/application/": "/guide/development/#应用组装",
	"architecture/deployment/": "/operations/",
	"architecture/observability/": "/operations/observability/",
	"architecture/request-lifecycle/": "/guide/development/#已认证的-todo-请求",
	"modules/": "/guide/development/#包扩展指引",
	"modules/database/": "/modules/db/",
	"modules/logging/": "/modules/observability/",
	"modules/todos/": "/modules/domain/",
	"modules/business/": "/modules/domain/",
	"en/modules/business/": "/en/modules/domain/",
	"modules/system/": "/guide/development/",
	"modules/api-client/": "/modules/api/",
	"modules/web/": "/guide/development/#应用扩展入口",
	"reference/": "/reference/http-api/",
};
for (const [route, target] of Object.entries(aliases)) {
	const href = `${base}${target.slice(1)}`;
	const file = path.join(output, route, "index.html");
	assert.ok(
		!existsSync(file),
		`Legacy redirect would overwrite a current page: ${route}`,
	);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(
		file,
		`<!doctype html><html lang="zh"><meta charset="utf-8"><title>Full Stack Example</title><link rel="canonical" href="${href}"><meta http-equiv="refresh" content="0;url=${href}"><p><a href="${href}">继续阅读 · Continue reading</a></p></html>`,
	);
}

for (const route of [
	"index.html",
	"en/index.html",
	"guide/development/index.html",
	"operations/index.html",
	"reference/http-api/index.html",
	"en/reference/typescript/index.html",
]) {
	assert.ok(
		existsSync(path.join(output, route)),
		`Missing required page: ${route}`,
	);
}
const spec = JSON.parse(
	readFileSync(path.join(output, "generated/openapi.json"), "utf8"),
);
assert.ok(spec.openapi.startsWith("3."));
assert.ok(Object.keys(spec.paths).length > 0, "Missing OpenAPI procedures");

const html = readdirSync(output, { recursive: true }).filter((file) =>
	file.endsWith(".html"),
);
let checked = 0;
for (const file of html) {
	const source = readFileSync(path.join(output, file), "utf8");
	for (const [, href] of source.matchAll(/(?:href|src)="([^"]+)"/g)) {
		if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href)) continue;
		const url = new URL(
			href.replaceAll("&amp;", "&"),
			`https://docs.invalid${base}${file}`,
		);
		assert.ok(
			url.pathname.startsWith(base),
			`${file}: link escaped deployment base: ${href}`,
		);
		let target = path.join(
			output,
			decodeURIComponent(url.pathname.slice(base.length)),
		);
		if (existsSync(target) && statSync(target).isDirectory())
			target = path.join(target, "index.html");
		assert.ok(existsSync(target), `${file}: broken static link: ${href}`);
		checked++;
	}
}
console.log(
	`Verified ${html.length} static pages, ${checked} local links/assets, legacy routes, and OpenAPI JSON under ${base}.`,
);
