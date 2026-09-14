import { runMigrations } from "bullmq";
import { Pool } from "pg";

export async function migrateJobs(options: { readonly databaseUrl: string }): Promise<void> {
  const pool = new Pool({ connectionString: options.databaseUrl });
  const client = await pool.connect();
  try {
    await runMigrations(client);
    await client.query(
      "ALTER FUNCTION bullmq.next_job_id(text) SECURITY DEFINER SET search_path = bullmq, pg_temp",
    );
    await client.query("GRANT USAGE ON SCHEMA bullmq TO app_runtime");
    await client.query(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA bullmq TO app_runtime",
    );
    await client.query(
      "GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA bullmq TO app_runtime",
    );
    await client.query("GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bullmq TO app_runtime");
    await client.query(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA bullmq GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime",
    );
    await client.query(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA bullmq GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_runtime",
    );
    await client.query(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA bullmq GRANT EXECUTE ON FUNCTIONS TO app_runtime",
    );
  } finally {
    client.release();
    await pool.end();
  }
}
