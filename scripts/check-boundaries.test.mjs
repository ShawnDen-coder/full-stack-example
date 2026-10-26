import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { boundaryRules, checkBoundaries } from "./check-boundaries.mjs";

function fixture(t) {
	const root = mkdtempSync(join(tmpdir(), "package-boundaries-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const put = (path, text) => {
		mkdirSync(join(root, path, ".."), { recursive: true });
		writeFileSync(join(root, path), text);
	};
	for (const id of Object.keys(boundaryRules)) {
		put(
			`${id}/package.json`,
			JSON.stringify({
				name: `@full-stack-example/${id.split("/")[1]}`,
				exports: {
					".": "./src/index.ts",
					"./routers/index": "./src/routers/index.ts",
					"./components/*": "./src/components/*.tsx",
				},
			}),
		);
		put(`${id}/src/index.ts`, "export const value = 1;");
		put(
			`${id}/tsconfig.json`,
			JSON.stringify({
				compilerOptions: {
					moduleResolution: "bundler",
					paths: {
						"@/*": ["./src/*"],
						"hidden/*": ["../../packages/db/src/*"],
					},
				},
			}),
		);
	}
	return { put, check: (rules) => checkBoundaries(root, rules) };
}

test("allows public exports, wildcard UI entries and type-only API contracts", (t) => {
	const f = fixture(t);
	f.put(
		"apps/web/src/client.ts",
		`
import type { Client } from '@full-stack-example/api/routers/index';
import { type Other } from '@full-stack-example/api/routers/index';
export type { Client as Alias } from '@full-stack-example/api/routers/index';
type Dynamic = import('@full-stack-example/api/routers/index').Client;
import { Button } from '@full-stack-example/ui/components/button';
import { value } from '@/index';`,
	);
	f.put(
		"packages/domain/src/service.ts",
		"import { value } from '@full-stack-example/db';",
	);
	assert.deepEqual(f.check(), []);
});

test("rejects forbidden edges, private exports and API runtime imports from web", (t) => {
	const f = fixture(t);
	f.put(
		"apps/worker/src/private.ts",
		"export * from '@full-stack-example/api';",
	);
	f.put(
		"apps/web/src/leak.ts",
		"import { Client } from '@full-stack-example/api/routers/index';",
	);
	f.put(
		"apps/server/src/private.ts",
		"import { secret } from '@full-stack-example/domain/src/private';",
	);
	const errors = f.check();
	assert.ok(
		errors.some(
			(error) => error.includes("apps/worker") && error.includes("forbidden"),
		),
	);
	assert.ok(errors.some((error) => error.includes("web may import only")));
	assert.ok(errors.some((error) => error.includes("private subpaths")));
});

test("checks dynamic imports, re-exports, require and type dependencies", (t) => {
	const f = fixture(t);
	f.put(
		"packages/ui/src/leak.ts",
		`
const db = import('@full-stack-example/db');
export type { Secret } from '@full-stack-example/api';
const worker = require('@full-stack-example/domain');
import foo = require('@full-stack-example/queue');`,
	);
	assert.equal(
		f.check().filter((error) => error.includes("dependency on")).length,
		4,
	);
});

test("relative paths and configured aliases cannot bypass exports or allowed edges", (t) => {
	const f = fixture(t);
	f.put(
		"apps/worker/src/leak.ts",
		"import { value } from '../../../packages/api/src/index';",
	);
	f.put(
		"packages/domain/src/private.ts",
		"import { value } from '../../db/src/index';",
	);
	f.put("apps/web/src/alias.ts", "import { value } from 'hidden/index';");
	const errors = f.check();
	assert.ok(
		errors.some(
			(error) =>
				error.includes("apps/worker") && error.includes("packages/api"),
		),
	);
	assert.ok(
		errors.some(
			(error) =>
				error.includes("packages/domain") &&
				error.includes("cross-package paths"),
		),
	);
	assert.ok(
		errors.some(
			(error) =>
				error.includes("hidden/index") && error.includes("packages/db"),
		),
	);
});

test("detects package cycles even when both edges are individually permitted", (t) => {
	const f = fixture(t);
	f.put(
		"packages/api/src/index.ts",
		"import type { A } from '@full-stack-example/domain';",
	);
	f.put(
		"packages/domain/src/index.ts",
		"import type { B } from '@full-stack-example/api';",
	);
	const errors = f.check({ ...boundaryRules, "packages/domain": ["api"] });
	assert.deepEqual(errors, [
		"Package cycle: packages/api -> packages/domain -> packages/api",
	]);
});

test("test fixtures are excluded and new production workspaces require a policy", (t) => {
	const f = fixture(t);
	f.put(
		"apps/web/tests/integration.ts",
		"import { db } from '@full-stack-example/db';",
	);
	assert.deepEqual(f.check(), []);
	f.put("packages/new/package.json", '{"name":"@full-stack-example/new"}');
	f.put("packages/new/src/index.ts", "export {};");
	assert.deepEqual(f.check(), ["packages/new: missing dependency policy"]);
});

test("aliases cannot redirect public-looking package names to private or foreign code", (t) => {
	const f = fixture(t);
	f.put(
		"apps/web/tsconfig.json",
		JSON.stringify({
			compilerOptions: {
				moduleResolution: "bundler",
				paths: {
					"@full-stack-example/ui/components/button": [
						"../../packages/db/src/index.ts",
					],
					"@full-stack-example/ui/components/private": [
						"../../packages/ui/src/private.ts",
					],
				},
			},
		}),
	);
	f.put("packages/ui/src/private.ts", "export const privateValue = 1;");
	f.put(
		"apps/web/src/leak.ts",
		`
import { value } from '@full-stack-example/ui/components/button';
import { privateValue } from '@full-stack-example/ui/components/private';`,
	);
	const errors = f.check();
	assert.ok(
		errors.some(
			(error) => error.includes("packages/db") && error.includes("forbidden"),
		),
	);
	assert.equal(
		errors.filter((error) => error.includes("use a public package export"))
			.length,
		2,
	);
});
