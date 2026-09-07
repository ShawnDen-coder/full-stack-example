import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export const defaultMigrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
const migrationLock = 814_206_329;

export async function migrateDatabase(options: {
  readonly databaseUrl: string;
  readonly migrationsFolder: string;
}): Promise<void> {
  const client = postgres(options.databaseUrl, { max: 1, connect_timeout: 30 });
  try {
    await client`SELECT pg_advisory_lock(${migrationLock})`;
    await migrate(await import("drizzle-orm/postgres-js").then(({ drizzle }) => drizzle(client)), {
      migrationsFolder: options.migrationsFolder,
    });
  } finally {
    try {
      await client`SELECT pg_advisory_unlock(${migrationLock})`;
    } finally {
      await client.end({ timeout: 5 });
    }
  }
}
