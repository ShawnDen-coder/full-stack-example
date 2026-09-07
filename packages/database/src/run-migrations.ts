import { z } from "zod";
import { defaultMigrationsFolder, migrateDatabase } from "./migrate.js";

const environmentSchema = z.object({ DATABASE_URL: z.url() });
const result = environmentSchema.safeParse(process.env);
if (!result.success) {
  console.error("DATABASE_URL is missing or invalid");
  process.exitCode = 1;
} else {
  await migrateDatabase({
    databaseUrl: result.data.DATABASE_URL,
    migrationsFolder: defaultMigrationsFolder,
  });
}
