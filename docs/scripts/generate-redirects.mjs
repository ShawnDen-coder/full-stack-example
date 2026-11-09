import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
