import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { migrateJobs } from "./migration.js";

const environmentFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const { DATABASE_MIGRATOR_URL: databaseUrl } = z
  .object({ DATABASE_MIGRATOR_URL: z.url() })
  .parse(process.env);
await migrateJobs({ databaseUrl });
