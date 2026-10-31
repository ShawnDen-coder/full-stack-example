import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
	boundaryRules,
	checkBoundaries,
	workspaceLayers,
} from "./check-boundaries.mjs";

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
	return {
		put,
		check: (rules, layers) => checkBoundaries(root, rules, layers),
	};
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
	assert.ok(
		errors.includes(
			"Package cycle: packages/api -> packages/domain -> packages/api",
		),
	);
	assert.ok(errors.some((error) => error.includes("reverse dependency")));
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
	assert.deepEqual(f.check(), [
		"packages/new: missing dependency policy",
		"packages/new: missing or invalid internal layer",
	]);
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

test("allowlists cannot authorize skipped layers, even for type-only imports", (t) => {
	const f = fixture(t);
	f.put(
		"apps/server/src/leak.ts",
		"import type { Database } from '@full-stack-example/db';",
	);
	const errors = f.check({ ...boundaryRules, "apps/server": ["db"] });
	assert.ok(errors.some((error) => error.includes("skipped internal layer")));
});

test("all levels may import L0 vendors, but internal packages cannot become L0", (t) => {
	const f = fixture(t);
	for (const id of Object.keys(boundaryRules))
		f.put(
			`${id}/src/vendor.ts`,
			"import { z } from 'zod'; import fs from 'node:fs';",
		);
	assert.deepEqual(f.check(), []);
	assert.ok(
		f
			.check(undefined, { ...workspaceLayers, "packages/db": 0 })
			.some((error) => error.includes("invalid internal layer")),
	);
});

test("valid same-layer references need explicit permission and remain acyclic", (t) => {
	const f = fixture(t);
	f.put(
		"packages/db/src/index.ts",
		"import { value } from '@full-stack-example/observability';",
	);
	assert.deepEqual(f.check(), []);
	f.put(
		"packages/observability/src/index.ts",
		"import { value } from '@full-stack-example/db';",
	);
	assert.ok(f.check().some((error) => error.includes("forbidden")));
	assert.ok(
		f
			.check({ ...boundaryRules, "packages/observability": ["db"] })
			.some((error) => error.startsWith("Package cycle:")),
	);
});

test("declarations and project references cannot hide unused forbidden dependencies", (t) => {
	const f = fixture(t);
	f.put(
		"apps/server/package.json",
		JSON.stringify({
			name: "server",
			devDependencies: { "@full-stack-example/db": "workspace:*" },
		}),
	);
	f.put(
		"apps/worker/tsconfig.json",
		JSON.stringify({ references: [{ path: "../../packages/db" }] }),
	);
	const errors = f.check();
	assert.ok(
		errors.some(
			(error) =>
				error.includes("package.json (devDependencies)") &&
				error.includes("skipped"),
		),
	);
	assert.ok(
		errors.some(
			(error) =>
				error.includes("tsconfig.json (references)") &&
				error.includes("skipped"),
		),
	);
});

test("declaration-only cycles are rejected", (t) => {
	const f = fixture(t);
	f.put(
		"packages/db/package.json",
		JSON.stringify({
			name: "@full-stack-example/db",
			dependencies: { "@full-stack-example/observability": "workspace:*" },
		}),
	);
	f.put(
		"packages/observability/package.json",
		JSON.stringify({
			name: "@full-stack-example/observability",
			peerDependencies: { "@full-stack-example/db": "workspace:*" },
		}),
	);
	assert.ok(
		f
			.check({ ...boundaryRules, "packages/observability": ["db"] })
			.some((error) => error.startsWith("Package cycle:")),
	);
});

test("CSS and build config imports follow the same internal dependency policy", (t) => {
	const f = fixture(t);
	f.put(
		"apps/web/src/leak.css",
		'@import "@full-stack-example/db/private.css";',
	);
	f.put("apps/server/build.config.ts", "import '@full-stack-example/db';");
	const errors = f.check();
	assert.ok(
		errors.some(
			(error) => error.includes("leak.css") && error.includes("skipped"),
		),
	);
	assert.ok(
		errors.some(
			(error) => error.includes("build.config.ts") && error.includes("skipped"),
		),
	);
});

test("production modules cannot launder dependencies through excluded test harnesses", (t) => {
	const f = fixture(t);
	f.put(
		"apps/server/tests/helper.ts",
		"export { value } from '@full-stack-example/db';",
	);
	f.put("scripts/helper.ts", "export { value } from '@full-stack-example/db';");
	f.put(
		"apps/server/src/leak.ts",
		"import '../tests/helper'; import '../../../scripts/helper';",
	);
	assert.equal(
		f.check().filter((error) => error.includes("test harnesses")).length,
		2,
	);
});
