import { existsSync, statSync } from "node:fs";
import path from "node:path";

export const repository =
	"https://github.com/ShawnDen-coder/full-stack-example";
export const packageNames = [
	"access",
	"api",
	"domain",
	"db",
	"queue",
	"observability",
	"ui",
];
export const languages = ["zh", "en"] as const;
export type Language = (typeof languages)[number];

export function pages(language: Language) {
	const suffix = language === "zh" ? ".zh-CN" : "";
	return [
		{ source: `README${suffix}.md`, route: "/" },
		{ source: `docs/development${suffix}.md`, route: "/guide/development/" },
		{
			source: `docs/extension-examples${suffix}.md`,
			route: "/guide/extension-examples/",
		},
		{
			source: `docs/extension-design${suffix}.md`,
			route: "/guide/extension-design/",
		},
		{ source: `CONTRIBUTING${suffix}.md`, route: "/guide/contributing/" },
		{ source: `docs/operations${suffix}.md`, route: "/operations/" },
		{
			source: `docs/access-control${suffix}.md`,
			route: "/guide/access-control/",
		},
		{ source: `container/README${suffix}.md`, route: "/operations/container/" },
		{
			source: `docs/observability${suffix}.md`,
			route: "/operations/observability/",
		},
		...packageNames.map((name) => ({
			source: `packages/${name}/README${suffix}.md`,
			route: `/modules/${name}/`,
		})),
	];
}

const pageRoutes = new Map(
	languages.flatMap((lang) =>
		pages(lang).map((page) => [page.source, { ...page, lang }]),
	),
);

export function siteRoute(route: string, language: Language) {
	return language === "en" ? `/en${route}` : route;
}

export function rewriteLink(href: string, source: string, root: string) {
	if (/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(href)) return href;
	const [filename, fragment] = href.split("#");
	if (!filename) return href;
	const resolved = path.resolve(
		root,
		path.dirname(source),
		decodeURIComponent(filename),
	);
	const relative = path.relative(root, resolved).split(path.sep).join("/");
	if (relative.startsWith("../"))
		throw new Error(`Link escapes repository: ${source}: ${href}`);
	const page = pageRoutes.get(relative);
	const anchor = fragment ? `#${fragment}` : "";
	if (page) return `${siteRoute(page.route, page.lang)}${anchor}`;
	if (!existsSync(resolved))
		throw new Error(`Broken source link: ${source}: ${href}`);
	const kind = statSync(resolved).isDirectory() ? "tree" : "blob";
	return `${repository}/${kind}/master/${relative.split("/").map(encodeURIComponent).join("/")}${anchor}`;
}

export function transformMarkdown(
	markdown: string,
	source: string,
	root: string,
) {
	let fence: string | undefined;
	return markdown
		.split("\n")
		.map((line) => {
			const delimiter = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
			if (delimiter) {
				if (!fence) fence = delimiter;
				else if (delimiter[0] === fence[0] && delimiter.length >= fence.length)
					fence = undefined;
				return line;
			}
			if (fence) return line;
			// Language and parent navigation are provided by the site shell.
			if (/^\[English\]\(/.test(line)) return "";
			if (/^\[(?:在线文档|Read online)\]\(/.test(line)) return "";
			return line.replace(
				/\]\(([^\s)]+)\)/g,
				(_, href) => `](${rewriteLink(href, source, root)})`,
			);
		})
		.join("\n");
}

export function sidebar(language: Language) {
	const zh = language === "zh";
	const item = (text: string, route: string) => ({
		text,
		link: siteRoute(route, language),
	});
	return [
		{
			text: zh ? "开始" : "Start",
			items: [item(zh ? "快速开始" : "Quick start", "/")],
		},
		{
			text: zh ? "开发" : "Development",
			items: [
				item(
					zh ? "架构与接线" : "Architecture and wiring",
					"/guide/development/",
				),
				item(
					zh ? "扩展示例" : "Extension examples",
					"/guide/extension-examples/",
				),
				item(
					zh ? "扩展约定" : "Extension contract",
					"/guide/extension-design/",
				),
				item(zh ? "权限控制" : "Access control", "/guide/access-control/"),
				item(zh ? "贡献与发布" : "Contributing", "/guide/contributing/"),
			],
		},
		{
			text: zh ? "运维" : "Operations",
			items: [
				item(zh ? "部署与恢复" : "Deployment and recovery", "/operations/"),
				item(zh ? "容器" : "Containers", "/operations/container/"),
				item(zh ? "可观测性" : "Observability", "/operations/observability/"),
			],
		},
		{
			text: zh ? "包指引" : "Packages",
			collapsible: true,
			collapsed: true,
			items: packageNames.map((name) => item(name, `/modules/${name}/`)),
		},
		{
			text: "Reference",
			collapsible: true,
			collapsed: true,
			items: [
				item("HTTP API", "/reference/http-api/"),
				item("TypeScript API", "/reference/typescript/"),
			],
		},
	];
}
