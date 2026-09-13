import { runMigrations } from "bullmq";
import { Pool } from "pg";

function identifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value))
    throw new Error(`Invalid PostgreSQL identifier: ${value}`);
  return `"${value}"`;
}

export async function migrateJobs(options: {
  readonly databaseUrl: string;
  readonly runtimeRole?: string;
}): Promise<void> {
  const pool = new Pool({ connectionString: options.databaseUrl });
  const client = await pool.connect();
  try {
    await runMigrations(client);
    await client.query(
      "ALTER FUNCTION bullmq.next_job_id(text) SECURITY DEFINER SET search_path = bullmq, pg_temp",
    );
    if (options.runtimeRole) {
      const role = identifier(options.runtimeRole);
      await client.query(`GRANT USAGE ON SCHEMA bullmq TO ${role}`);
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA bullmq TO ${role}`,
      );
      await client.query(
        `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA bullmq TO ${role}`,
      );
      await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bullmq TO ${role}`);
      await client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA bullmq GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA bullmq GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${role}`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA bullmq GRANT EXECUTE ON FUNCTIONS TO ${role}`,
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}
