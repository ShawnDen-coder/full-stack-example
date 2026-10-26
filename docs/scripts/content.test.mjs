import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pages, rewriteLink, siteRoute, transformMarkdown } from "./content.ts";

test("maps both languages to actual site routes and retains anchors", () => {
	assert.equal(
		rewriteLink(
			"../packages/domain/README.zh-CN.md#扩展步骤",
			"docs/development.zh-CN.md",
			process.cwd(),
		),
		"/modules/domain/#扩展步骤",
	);
	assert.equal(
		rewriteLink(
			"../CONTRIBUTING.md#versioning",
			"docs/development.md",
			process.cwd(),
		),
		"/en/guide/contributing/#versioning",
	);
	assert.equal(siteRoute("/operations/", "en"), "/en/operations/");
	assert.equal(pages("en").length, pages("zh").length);
});

test("keeps examples and diagrams intact while replacing reading links", () => {
	const input =
		"[English](README.md) · [简体中文](README.zh-CN.md)\n\n[Guide](docs/development.zh-CN.md)\n\n```md\n[Example](missing.md)\n```\n\n```mermaid\nflowchart LR\nA-->B\n```\n";
	const output = transformMarkdown(input, "README.zh-CN.md", process.cwd());
	assert.ok(!output.includes("[English]"));
	assert.ok(output.includes("[Guide](/guide/development/)"));
	assert.ok(output.includes("[Example](missing.md)"));
	assert.ok(output.includes("```mermaid\nflowchart LR\nA-->B\n```"));
});

test("sends repository files to GitHub and rejects broken or escaping links", async () => {
	const root = await mkdtemp(path.join(tmpdir(), "docs-links-"));
	await mkdir(path.join(root, "src"));
	await writeFile(path.join(root, "src/example.ts"), "");
	assert.equal(
		rewriteLink("src/example.ts", "README.md", root),
		"https://github.com/ShawnDen-coder/full-stack-example/blob/master/src/example.ts",
	);
	assert.throws(
		() => rewriteLink("missing.ts", "README.md", root),
		/Broken source link/,
	);
	assert.throws(
		() => rewriteLink("../outside.md", "README.md", root),
		/escapes repository/,
	);
	assert.equal(
		rewriteLink("https://example.com", "README.md", root),
		"https://example.com",
	);
});
