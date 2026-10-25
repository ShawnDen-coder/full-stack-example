import assert from "node:assert/strict";
import { test } from "node:test";
import { deploy, validateProductionEnv } from "./deploy.mjs";

const env = {
	PUBLIC_APP_URL: "https://app.example.test",
	BETTER_AUTH_SECRET: "test-only-32-character-secret-value",
	POSTGRES_PASSWORD: "test-only",
	MIGRATION_DATABASE_URL: "postgresql://postgres:test-only@postgres:5432/app",
	DATABASE_URL: "postgresql://app_server:server-test-only@postgres:5432/app",
	WORKER_DATABASE_URL:
		"postgresql://app_worker:worker-test-only@postgres:5432/app",
};

test("deployment rejects incomplete configuration before running commands", () => {
	for (const invalid of [
		{},
		{ ...env, PUBLIC_APP_URL: "http://app.example.test" },
		{ ...env, BETTER_AUTH_SECRET: "short" },
		{ ...env, PUBLIC_APP_URL: "https://app.example.test/path" },
	])
		assert.throws(() => validateProductionEnv(invalid));
});
test("migration failure prevents application replacement", () => {
	const calls = [];
	assert.throws(
		() =>
			deploy(env, (_command, args) => {
				calls.push(args.slice(3));
				return { status: args.includes("migrate") ? 1 : 0 };
			}),
		/Deployment stopped/,
	);
	assert.equal(calls.length, 3);
	assert.deepEqual(calls.at(-1), ["run", "--rm", "migrate"]);
	assert.ok(!calls.some((args) => args.includes("server")));
});
test("deployment waits for dependencies and migration before starting applications", () => {
	const calls = [];
	deploy(env, (_command, args) => {
		calls.push(args.slice(3));
		return { status: 0 };
	});
	assert.deepEqual(calls, [
		["build"],
		["up", "-d", "--wait", "postgres", "redis"],
		["run", "--rm", "migrate"],
		["run", "--rm", "--no-deps", "provision"],
		["up", "-d", "--no-deps", "--wait", "server", "worker"],
		["up", "-d", "--no-deps", "--force-recreate", "--wait", "web"],
	]);
});

test("runtime roles and migration owner cannot share credentials or databases", () => {
	for (const invalid of [
		{ ...env, DATABASE_URL: env.MIGRATION_DATABASE_URL },
		{
			...env,
			WORKER_DATABASE_URL: "postgresql://app_worker:test@elsewhere:5432/app",
		},
		{
			...env,
			MIGRATION_DATABASE_URL: "postgresql://postgres:wrong@postgres:5432/app",
		},
	])
		assert.throws(() => validateProductionEnv(invalid));
});
test("role provisioning failure prevents application replacement", () => {
	const calls = [];
	assert.throws(
		() =>
			deploy(env, (_command, args) => {
				calls.push(args);
				return { status: args.includes("provision") ? 1 : 0 };
			}),
		/Deployment stopped/,
	);
	assert.ok(!calls.some((args) => args.includes("server")));
});
