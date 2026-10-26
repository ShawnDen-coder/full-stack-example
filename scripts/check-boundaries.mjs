import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export const boundaryRules = {
	"apps/web": ["ui", "api"],
	"apps/server": ["api", "domain", "db", "queue", "observability"],
	"apps/worker": ["domain", "db", "queue", "observability"],
	"packages/api": ["domain", "db", "queue", "observability"],
	"packages/domain": ["db", "queue", "observability"],
	"packages/db": ["observability"],
	"packages/queue": [],
	"packages/observability": [],
	"packages/ui": [],
};

function files(directory) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory()
			? files(path)
			: /\.[cm]?[jt]sx?$/.test(path)
				? [path]
				: [];
	});
}

function imports(source) {
	const result = [];
	const add = (node, literal, typeOnly) => {
		if (literal && ts.isStringLiteralLike(literal))
			result.push({
				specifier: literal.text,
				typeOnly,
				line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
			});
	};
	const visit = (node) => {
		if (ts.isImportDeclaration(node)) {
			const clause = node.importClause;
			const bindings = clause?.namedBindings;
			add(
				node,
				node.moduleSpecifier,
				Boolean(
					clause?.isTypeOnly ||
						(!clause?.name &&
							bindings &&
							ts.isNamedImports(bindings) &&
							bindings.elements.length &&
							bindings.elements.every((item) => item.isTypeOnly)),
				),
			);
		} else if (ts.isExportDeclaration(node)) {
			add(
				node,
				node.moduleSpecifier,
				node.isTypeOnly ||
					Boolean(
						node.exportClause &&
							ts.isNamedExports(node.exportClause) &&
							node.exportClause.elements.length &&
							node.exportClause.elements.every((item) => item.isTypeOnly),
					),
			);
		} else if (
			ts.isImportTypeNode(node) &&
			ts.isLiteralTypeNode(node.argument)
		) {
			add(node, node.argument.literal, true);
		} else if (
			ts.isCallExpression(node) &&
			(node.expression.kind === ts.SyntaxKind.ImportKeyword ||
				(ts.isIdentifier(node.expression) &&
					node.expression.text === "require"))
		)
			add(node, node.arguments[0], false);
		else if (
			ts.isImportEqualsDeclaration(node) &&
			ts.isExternalModuleReference(node.moduleReference)
		)
			add(node, node.moduleReference.expression, node.isTypeOnly);
		ts.forEachChild(node, visit);
	};
	visit(source);
	return result;
}

function patternMatch(pattern, value) {
	if (!pattern.includes("*")) return pattern === value ? "" : undefined;
	const [prefix, suffix] = pattern.split("*");
	if (
		value.startsWith(prefix) &&
		value.endsWith(suffix) &&
		value.length >= prefix.length + suffix.length
	)
		return value.slice(
			prefix.length,
			value.length - suffix.length || undefined,
		);
}
function publicTargets(workspace, specifier) {
	const { manifest, directory } = workspace;
	const subpath =
		specifier === manifest.name
			? "."
			: `.${specifier.slice(manifest.name.length)}`;
	const exports = manifest.exports;
	if (!exports) return [];
	const entries =
		typeof exports === "string" ||
		!Object.keys(exports).some((key) => key.startsWith("."))
			? { ".": exports }
			: exports;
	const key = Object.keys(entries)
		.filter((key) => patternMatch(key, subpath) !== undefined)
		.sort(
			(a, b) =>
				Number(b === subpath) - Number(a === subpath) || b.length - a.length,
		)[0];
	if (!key) return [];
	const strings = (value) =>
		typeof value === "string"
			? [value]
			: value && typeof value === "object"
				? Object.values(value).flatMap(strings)
				: [];
	return strings(entries[key])
		.filter((value) => value.startsWith("./"))
		.map((value) =>
			resolve(directory, value.replaceAll("*", patternMatch(key, subpath))),
		);
}

export function checkBoundaries(workspaceRoot, rules = boundaryRules) {
	const root = resolve(workspaceRoot);
	const workspaces = ["apps", "packages"].flatMap((group) =>
		readdirSync(join(root, group), { withFileTypes: true })
			.filter(
				(entry) =>
					entry.isDirectory() &&
					existsSync(join(root, group, entry.name, "package.json")),
			)
			.map((entry) => {
				const directory = join(root, group, entry.name);
				const configPath = join(directory, "tsconfig.json");
				const config = existsSync(configPath)
					? ts.readConfigFile(configPath, ts.sys.readFile)
					: { config: {} };
				if (config.error) throw new Error(`Cannot read ${configPath}`);
				const { options } = ts.parseJsonConfigFileContent(
					config.config,
					ts.sys,
					directory,
				);
				return {
					directory,
					id: `${group}/${entry.name}`,
					manifest: JSON.parse(
						readFileSync(join(directory, "package.json"), "utf8"),
					),
					options,
				};
			}),
	);
	const owner = (file) =>
		workspaces.find(
			({ directory }) =>
				file === directory || file.startsWith(`${directory}${sep}`),
		);
	const diagnostics = [];
	const graph = new Map(
		workspaces.map((workspace) => [workspace.id, new Set()]),
	);
	for (const workspace of workspaces) {
		if (!Object.hasOwn(rules, workspace.id))
			diagnostics.push(`${workspace.id}: missing dependency policy`);
		for (const file of files(join(workspace.directory, "src"))) {
			const source = ts.createSourceFile(
				file,
				readFileSync(file, "utf8"),
				ts.ScriptTarget.Latest,
				true,
			);
			for (const { specifier, typeOnly, line } of imports(source)) {
				const named = workspaces.find(
					({ manifest }) =>
						specifier === manifest.name ||
						specifier.startsWith(`${manifest.name}/`),
				);

				let path = ts.resolveModuleName(
					specifier,
					file,
					workspace.options,
					ts.sys,
				).resolvedModule?.resolvedFileName;
				if (!path && specifier.startsWith("."))
					path = resolve(dirname(file), specifier);
				// TypeScript does not resolve stylesheet assets; still inspect aliases for boundaries.
				if (!path)
					for (const [pattern, substitutions] of Object.entries(
						workspace.options.paths ?? {},
					)) {
						const wildcard = patternMatch(pattern, specifier);
						if (wildcard !== undefined) {
							path = resolve(
								workspace.options.baseUrl ??
									workspace.options.pathsBasePath ??
									workspace.directory,
								substitutions[0].replace("*", wildcard),
							);
							break;
						}
					}
				if (!path && isAbsolute(specifier)) path = specifier;
				const target = (path && owner(resolve(path))) || named;
				if (!target) {
					if (specifier.startsWith("@full-stack-example/"))
						diagnostics.push(
							`${relative(root, file).split(sep).join("/")}:${line}: unknown internal package ${specifier}`,
						);
					continue;
				}
				if (target === workspace && (!named || named === workspace)) continue;
				if (target !== workspace) graph.get(workspace.id).add(target.id);
				const errors = [];
				if (
					!(rules[workspace.id] ?? []).includes(
						target.id.replace("packages/", ""),
					)
				)
					errors.push(`dependency on ${target.id} is forbidden`);
				if (
					!named ||
					named !== target ||
					!publicTargets(named, specifier).some(
						(exported) => !path || exported === resolve(path),
					)
				)
					errors.push(
						"use a public package export; cross-package paths and private subpaths are forbidden",
					);
				if (
					workspace.id === "apps/web" &&
					target.id === "packages/api" &&
					(!typeOnly || specifier !== `${target.manifest.name}/routers/index`)
				)
					errors.push(
						"web may import only the API router client contract with import type",
					);
				for (const error of errors)
					diagnostics.push(
						`${relative(root, file).split(sep).join("/")}:${line}: ${specifier}: ${error}`,
					);
			}
		}
	}
	const visited = new Set();
	const active = [];
	const visit = (id) => {
		if (active.includes(id)) {
			diagnostics.push(
				`Package cycle: ${[...active.slice(active.indexOf(id)), id].join(" -> ")}`,
			);
			return;
		}
		if (visited.has(id)) return;
		visited.add(id);
		active.push(id);
		for (const target of graph.get(id)) visit(target);
		active.pop();
	};
	for (const id of graph.keys()) visit(id);
	return [...new Set(diagnostics)];
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	const errors = checkBoundaries(
		fileURLToPath(new URL("../", import.meta.url)),
	);
	if (errors.length) {
		console.error(errors.join("\n"));
		process.exitCode = 1;
	} else console.log("Package dependency boundaries passed");
}
