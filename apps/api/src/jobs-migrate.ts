import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrateJobs } from "@full-stack-example/jobs/migration";
import { parseMigrationConfig } from "./config.js";

const environmentFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const config = parseMigrationConfig();
await migrateJobs({ databaseUrl: config.databaseUrl, runtimeRole: "app_runtime" });
