import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("legacy redirects use the base and refuse to overwrite existing pages", (t) => {
	const root = mkdtempSync(join(tmpdir(), "docs-redirects-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "scripts"));
	copyFileSync(
		fileURLToPath(new URL("./generate-redirects.mjs", import.meta.url)),
		join(root, "scripts/generate-redirects.mjs"),
	);
	const options = {
		env: { ...process.env, DOCS_BASE: "/custom/" },
		stdio: "pipe",
	};
	execFileSync(
		process.execPath,
		[join(root, "scripts/generate-redirects.mjs")],
		options,
	);
	const page = readFileSync(
		join(root, "doc_build/guide/getting-started/index.html"),
		"utf8",
	);
	assert.ok(page.includes('href="/custom/#快速开始"'));
	assert.throws(() =>
		execFileSync(
			process.execPath,
			[join(root, "scripts/generate-redirects.mjs")],
			options,
		),
	);
	assert.equal(
		readFileSync(
			join(root, "doc_build/guide/getting-started/index.html"),
			"utf8",
		),
		page,
	);
});
