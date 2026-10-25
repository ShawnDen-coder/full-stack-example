import type { Database } from "./index";

export function runtimeDatabaseConfig(
	serverUrl: string,
	workerUrl: string,
	migrationUrl: string,
) {
	const server = new URL(serverUrl);
	const worker = new URL(workerUrl);
	const owner = new URL(migrationUrl);
	for (const [url, role] of [
		[server, "app_server"],
		[worker, "app_worker"],
	] as const) {
		if (
			!["postgres:", "postgresql:"].includes(url.protocol) ||
			url.hostname !== owner.hostname ||
			(url.port || "5432") !== (owner.port || "5432") ||
			url.pathname !== owner.pathname ||
			url.username !== role ||
			!url.password
		) {
			throw new Error(
				"Runtime database URLs must target the migration database with app_server/app_worker credentials",
			);
		}
	}
	if (
		!["postgres:", "postgresql:"].includes(owner.protocol) ||
		["app_server", "app_worker"].includes(owner.username)
	)
		throw new Error("Migration database must use a separate schema owner");
	return {
		serverPassword: decodeURIComponent(server.password),
		workerPassword: decodeURIComponent(worker.password),
	};
}

// Deployment-only operation. SQL identifiers are fixed; password values are parameters.
export async function provisionRuntimeRoles(
	db: Database,
	urls: { server: string; worker: string; migration: string },
) {
	const { serverPassword, workerPassword } = runtimeDatabaseConfig(
		urls.server,
		urls.worker,
		urls.migration,
	);
	const client = await db.$client.connect();
	try {
		await client.query("BEGIN");
		await client.query(
			"SELECT set_config('app.server_password', $1, true), set_config('app.worker_password', $2, true)",
			[serverPassword, workerPassword],
		);
		await client.query(`
DO $$
BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_server') THEN CREATE ROLE app_server; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_worker') THEN CREATE ROLE app_worker; END IF;
 EXECUTE format('ALTER ROLE app_server LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD %L', current_setting('app.server_password'));
 EXECUTE format('ALTER ROLE app_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD %L', current_setting('app.worker_password'));
 EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_server, app_worker', current_database());
END $$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM app_server, app_worker;
GRANT USAGE ON SCHEMA public TO app_server, app_worker;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_server, app_worker;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_server, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."user", public.session, public.account, public.verification, public.todo TO app_server;
GRANT USAGE, SELECT ON SEQUENCE public.todo_id_seq TO app_server;
GRANT SELECT ON TABLE public."user" TO app_worker;
`);
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}
