import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("../doc_build/", import.meta.url));
const base = process.env.DOCS_BASE ?? "/full-stack-example/";
assert.ok(
	base.startsWith("/") && base.endsWith("/"),
	"DOCS_BASE must start and end with /",
);

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
// New bilingual pages must have matching routes, searchable content and real anchors.
for (const [lang, prefix, anchors] of [
	["zh", "", ["扩展", "workspace-权限", "本地开发"]],
	["en", "en/", ["extend", "workspace-access", "local-development"]],
]) {
	const searchFile = readdirSync(path.join(output, "static")).find((file) =>
		file.startsWith(`search_index.${lang}.`),
	);
	assert.ok(searchFile, `Missing ${lang} search index`);
	const index = JSON.parse(
		readFileSync(path.join(output, "static", searchFile), "utf8"),
	);
	for (const [i, route] of [
		"modules/access/",
		"guide/access-control/",
		"operations/container/",
	].entries()) {
		const routePath = `/${prefix}${route}`;
		const page = readFileSync(
			path.join(output, prefix, route, "index.html"),
			"utf8",
		);
		assert.ok(
			page.includes(`id="${anchors[i]}"`),
			`${routePath}: missing anchor`,
		);
		assert.ok(
			index.some((item) => item.routePath === routePath),
			`${routePath}: missing search entry`,
		);
	}
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
