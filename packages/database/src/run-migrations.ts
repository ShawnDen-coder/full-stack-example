import { z } from "zod";
import { defaultMigrationsFolder, migrateDatabase } from "./migrate.js";

const environmentSchema = z.object({
  DATABASE_URL: z.url().optional(),
  DATABASE_MIGRATOR_URL: z.url().optional(),
});
const result = environmentSchema.safeParse(process.env);
const databaseUrl = result.success
  ? (result.data.DATABASE_MIGRATOR_URL ?? result.data.DATABASE_URL)
  : undefined;
if (!databaseUrl) {
  console.error("DATABASE_MIGRATOR_URL or DATABASE_URL is missing or invalid");
  process.exitCode = 1;
} else {
  await migrateDatabase({
    databaseUrl,
    migrationsFolder: defaultMigrationsFolder,
  });
}
