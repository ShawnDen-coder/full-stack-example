import { defaultMigrationsFolder, migrateDatabase } from "@full-stack-example/database";
import { migrateJobs } from "@full-stack-example/jobs/migration";
import { parseMigrationConfig } from "../config/migration.js";
import { loadWorkspaceEnvironment } from "../runtime/environment.js";

loadWorkspaceEnvironment();

const { databaseUrl } = parseMigrationConfig();
await migrateDatabase({ databaseUrl, migrationsFolder: defaultMigrationsFolder });
await migrateJobs({ databaseUrl });
