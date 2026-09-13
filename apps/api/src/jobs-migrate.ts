import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrateJobs } from "@full-stack-example/jobs/migration";
import { parseJobsMigrationConfig } from "./config.js";

const environmentFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const config = parseJobsMigrationConfig();
await migrateJobs({ databaseUrl: config.databaseUrl, runtimeRole: config.runtimeRole });
