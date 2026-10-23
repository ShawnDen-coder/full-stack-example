import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

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
		!env.DATABASE_URL
	) {
		throw new Error(
			"Provide BETTER_AUTH_SECRET (32+ characters), POSTGRES_PASSWORD and DATABASE_URL",
		);
	}
}

export function deploy(env, run = spawnSync) {
	validateProductionEnv(env);
	const compose = (...args) => {
		const result = run(
			"docker",
			["compose", "-f", "compose.production.yml", ...args],
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
	compose("up", "-d", "--no-deps", "--wait", "server", "worker");
	// Nginx resolves the upstream at startup; refresh it after API replacement.
	compose("up", "-d", "--no-deps", "--force-recreate", "--wait", "web");
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
	deploy(process.env);
