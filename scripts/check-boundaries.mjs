import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

import { boundaryRules, workspaceLayers } from "./architecture-policy.mjs";
import { checkLayerDependency } from "./dependency-layers.mjs";

export { boundaryRules, workspaceLayers } from "./architecture-policy.mjs";

function files(directory) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory()
			? files(path)
			: /\.(?:[cm]?[jt]sx?|css)$/.test(path)
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

export function checkBoundaries(
	workspaceRoot,
	rules = boundaryRules,
	layers = workspaceLayers,
) {
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
				const { options, projectReferences } = ts.parseJsonConfigFileContent(
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
					projectReferences: projectReferences ?? [],
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
	const checkEdge = (workspace, target, location) => {
		graph.get(workspace.id).add(target.id);
		const errors = [];
		if (
			!(rules[workspace.id] ?? []).includes(target.id.replace("packages/", ""))
		)
			errors.push(`dependency on ${target.id} is forbidden`);
		const layerError = checkLayerDependency(workspace.id, target.id, layers);
		if (layerError) errors.push(layerError);
		if (location)
			for (const error of errors) diagnostics.push(`${location}: ${error}`);
		return errors;
	};
	for (const workspace of workspaces) {
		if (!Object.hasOwn(rules, workspace.id))
			diagnostics.push(`${workspace.id}: missing dependency policy`);
		if (!Number.isInteger(layers[workspace.id]) || layers[workspace.id] < 1)
			diagnostics.push(`${workspace.id}: missing or invalid internal layer`);
		// Validate declarations even if no source file currently imports the dependency.
		for (const field of [
			"dependencies",
			"devDependencies",
			"peerDependencies",
			"optionalDependencies",
		]) {
			for (const name of Object.keys(workspace.manifest[field] ?? {})) {
				const target = workspaces.find(
					({ manifest }) => manifest.name === name,
				);
				if (target)
					checkEdge(
						workspace,
						target,
						`${workspace.id}/package.json (${field})`,
					);
				else if (name.startsWith("@full-stack-example/"))
					diagnostics.push(
						`${workspace.id}/package.json: unknown internal package ${name}`,
					);
			}
		}
		for (const ref of workspace.projectReferences) {
			const target = owner(resolve(ref.path));
			if (target)
				checkEdge(
					workspace,
					target,
					`${workspace.id}/tsconfig.json (references)`,
				);
			else
				diagnostics.push(
					`${workspace.id}/tsconfig.json: project reference has no internal dependency policy: ${ref.path}`,
				);
		}
		// Check production configs as well as src. Test harnesses are deliberately separate.
		const productionFiles = [
			...files(join(workspace.directory, "src")),
			...readdirSync(workspace.directory)
				.filter((name) => /\.[cm]?[jt]sx?$/.test(name))
				.map((name) => join(workspace.directory, name)),
		];
		for (const file of productionFiles) {
			const source = ts.createSourceFile(
				file,
				readFileSync(file, "utf8"),
				ts.ScriptTarget.Latest,
				true,
			);
			const references = file.endsWith(".css")
				? [
						...source.text.matchAll(
							/@(?:import|reference)\s+(?:url\(\s*)?["']([^"']+)["']/g,
						),
					].map((match) => ({
						specifier: match[1],
						typeOnly: false,
						line: source.text.slice(0, match.index).split("\n").length,
					}))
				: imports(source);
			for (const { specifier, typeOnly, line } of references) {
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
							if (file.endsWith(".css") && !existsSync(path)) path = undefined;
							break;
						}
					}
				if (!path && isAbsolute(specifier)) path = specifier;
				const target = (path && owner(resolve(path))) || named;
				if (
					path &&
					!path.split(sep).includes("node_modules") &&
					(!target ||
						/(^|\/)(tests?|fixtures)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/.test(
							relative(target.directory, path).split(sep).join("/"),
						))
				) {
					diagnostics.push(
						`${relative(root, file).split(sep).join("/")}:${line}: production code may not import test harnesses or files outside declared workspaces: ${specifier}`,
					);
					continue;
				}
				if (!target) {
					if (specifier.startsWith("@full-stack-example/"))
						diagnostics.push(
							`${relative(root, file).split(sep).join("/")}:${line}: unknown internal package ${specifier}`,
						);
					continue;
				}
				if (target === workspace && (!named || named === workspace)) continue;
				const errors = checkEdge(workspace, target);
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
