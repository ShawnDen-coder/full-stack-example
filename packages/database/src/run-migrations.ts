import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { defaultMigrationsFolder, migrateDatabase } from "./migrate.js";

const environmentFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const environmentSchema = z.object({
  DATABASE_MIGRATOR_URL: z.url({ error: "must be a valid URL" }),
});
const result = environmentSchema.safeParse(process.env);
if (!result.success)
  throw new Error(
    `Invalid Database migration environment:\n- DATABASE_MIGRATOR_URL: ${
      process.env.DATABASE_MIGRATOR_URL?.trim() ? "must be a valid URL" : "is required"
    }`,
  );

await migrateDatabase({
  databaseUrl: result.data.DATABASE_MIGRATOR_URL,
  migrationsFolder: defaultMigrationsFolder,
});
