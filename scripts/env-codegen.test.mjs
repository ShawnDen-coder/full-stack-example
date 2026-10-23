import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const autoLoadUrl = import.meta.resolve("varlock/auto-load");
const envUrl = import.meta.resolve("varlock/env");
const cliPath = fileURLToPath(
	new URL("../bin/cli.js", import.meta.resolve("varlock")),
);
const env = {
	PATH: process.env.PATH,
	NODE_ENV: "production",
	DATABASE_URL: "postgresql://postgres:test-only@localhost:5432/app",
	REDIS_URL: "redis://localhost:6379",
	BETTER_AUTH_SECRET: "test-only-secret-at-least-32-characters",
	BETTER_AUTH_URL: "https://app.example.test",
	CORS_ORIGIN: "https://app.example.test",
};

for (const app of ["server", "worker"]) {
	test(`${app} loads production config without generating source files`, () => {
		const cwd = mkdtempSync(join(tmpdir(), `${app}-env-`));
		try {
			// Runtime images contain the schema and built output, but no app src.
			copyFileSync(
				new URL(`../apps/${app}/.env.schema`, import.meta.url),
				join(cwd, ".env.schema"),
			);
			const loaded = spawnSync(
				process.execPath,
				[
					"--input-type=module",
					"--eval",
					`import ${JSON.stringify(autoLoadUrl)};
import { ENV } from ${JSON.stringify(envUrl)};
import assert from 'node:assert/strict';
assert.equal(ENV.NODE_ENV, 'production');
assert.equal(ENV.DB_POOL_MAX, 10);`,
				],
				{ cwd, env, encoding: "utf8", timeout: 30_000 },
			);
			assert.equal(loaded.status, 0, loaded.stderr || loaded.stdout);
			assert.equal(existsSync(join(cwd, "src")), false);

			// Installation and env:generate must still be able to generate types.
			const generated = spawnSync(process.execPath, [cliPath, "codegen"], {
				cwd,
				env,
				encoding: "utf8",
				timeout: 30_000,
			});
			assert.equal(generated.status, 0, generated.stderr || generated.stdout);
			assert.ok(existsSync(join(cwd, "src/env.ts")));
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});
}
