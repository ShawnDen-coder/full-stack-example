import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultMigrationsFolder, migrateDatabase } from "@full-stack-example/database";
import { migrateJobs } from "@full-stack-example/jobs/migration";
import { parseMigrationConfig } from "./config.js";

const environmentFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const { databaseUrl } = parseMigrationConfig();
await migrateDatabase({ databaseUrl, migrationsFolder: defaultMigrationsFolder });
await migrateJobs({ databaseUrl });
