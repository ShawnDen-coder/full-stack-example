import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function databaseUrl(value) {
	try {
		return new URL(value);
	} catch {
		throw new Error("Invalid database URL");
	}
}

export function validateProductionEnv(env) {
	const url = new URL(env.PUBLIC_APP_URL || "https://missing.invalid");
	if (
		!env.PUBLIC_APP_URL ||
		url.protocol !== "https:" ||
		url.pathname !== "/" ||
		url.search ||
		url.hash ||
		url.username ||
		url.password
	) {
		throw new Error("PUBLIC_APP_URL must be an HTTPS origin");
	}
	if (
		(env.BETTER_AUTH_SECRET?.length ?? 0) < 32 ||
		!env.POSTGRES_PASSWORD ||
		!env.DATABASE_URL ||
		!env.WORKER_DATABASE_URL ||
		!env.MIGRATION_DATABASE_URL
	) {
		throw new Error(
			"Provide BETTER_AUTH_SECRET (32+ characters), POSTGRES_PASSWORD, DATABASE_URL, WORKER_DATABASE_URL and MIGRATION_DATABASE_URL",
		);
	}
	const owner = databaseUrl(env.MIGRATION_DATABASE_URL);
	if (
		!["postgres:", "postgresql:"].includes(owner.protocol) ||
		owner.hostname !== "postgres" ||
		(owner.port || "5432") !== "5432" ||
		owner.pathname !== "/app" ||
		owner.username !== "postgres" ||
		decodeURIComponent(owner.password) !== env.POSTGRES_PASSWORD
	)
		throw new Error(
			"Migration URL must use postgres:5432/app with the configured owner password",
		);
	for (const [value, role] of [
		[env.DATABASE_URL, "app_server"],
		[env.WORKER_DATABASE_URL, "app_worker"],
	]) {
		const url = databaseUrl(value);
		if (
			!["postgres:", "postgresql:"].includes(url.protocol) ||
			url.hostname !== owner.hostname ||
			(url.port || "5432") !== "5432" ||
			url.pathname !== owner.pathname ||
			url.username !== role ||
			!url.password
		)
			throw new Error(
				"Runtime URLs must use app_server/app_worker on postgres:5432/app",
			);
	}
}

export function deploy(env, run = spawnSync) {
	validateProductionEnv(env);
	const compose = (...args) => {
		const result = run(
			"docker",
			["compose", "-f", "container/compose.production.yml", ...args],
			{ stdio: "inherit", env },
		);
		if (result.error) throw result.error;
		if (result.status !== 0)
			throw new Error(
				`Deployment stopped during ${args[0]} (exit ${result.status})`,
			);
	};
	compose("build");
	compose("up", "-d", "--wait", "postgres", "redis");
	// Every release runs a fresh migration task. On failure, preserve running apps.
	compose("run", "--rm", "migrate");
	compose("run", "--rm", "--no-deps", "provision");
	compose("up", "-d", "--no-deps", "--wait", "server", "worker");
	// Nginx resolves the upstream at startup; refresh it after API replacement.
	compose("up", "-d", "--no-deps", "--force-recreate", "--wait", "web");
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
	deploy(process.env);
