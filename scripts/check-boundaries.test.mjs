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
				name: `@my-better-t-app/${id.split("/")[1]}`,
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
import type { Client } from '@my-better-t-app/api/routers/index';
import { type Other } from '@my-better-t-app/api/routers/index';
export type { Client as Alias } from '@my-better-t-app/api/routers/index';
type Dynamic = import('@my-better-t-app/api/routers/index').Client;
import { Button } from '@my-better-t-app/ui/components/button';
import { value } from '@/index';`,
	);
	f.put(
		"packages/business/src/service.ts",
		"import { value } from '@my-better-t-app/db';",
	);
	assert.deepEqual(f.check(), []);
});

test("rejects forbidden edges, private exports and API runtime imports from web", (t) => {
	const f = fixture(t);
	f.put("apps/worker/src/private.ts", "export * from '@my-better-t-app/api';");
	f.put(
		"apps/web/src/leak.ts",
		"import { Client } from '@my-better-t-app/api/routers/index';",
	);
	f.put(
		"apps/server/src/private.ts",
		"import { secret } from '@my-better-t-app/business/src/private';",
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
const db = import('@my-better-t-app/db');
export type { Secret } from '@my-better-t-app/api';
const worker = require('@my-better-t-app/business');
import foo = require('@my-better-t-app/queue');`,
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
		"packages/business/src/private.ts",
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
				error.includes("packages/business") &&
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
		"import type { A } from '@my-better-t-app/business';",
	);
	f.put(
		"packages/business/src/index.ts",
		"import type { B } from '@my-better-t-app/api';",
	);
	const errors = f.check({ ...boundaryRules, "packages/business": ["api"] });
	assert.deepEqual(errors, [
		"Package cycle: packages/api -> packages/business -> packages/api",
	]);
});

test("test fixtures are excluded and new production workspaces require a policy", (t) => {
	const f = fixture(t);
	f.put(
		"apps/web/tests/integration.ts",
		"import { db } from '@my-better-t-app/db';",
	);
	assert.deepEqual(f.check(), []);
	f.put("packages/new/package.json", '{"name":"@my-better-t-app/new"}');
	f.put("packages/new/src/index.ts", "export {};");
	assert.deepEqual(f.check(), ["packages/new: missing dependency policy"]);
});
