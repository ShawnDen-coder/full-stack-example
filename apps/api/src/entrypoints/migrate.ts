import { defaultMigrationsFolder, migrateDatabase } from "@full-stack-example/database";
import { migrateJobs } from "@full-stack-example/jobs/migration";
import { parseMigrationEnvironment } from "../config/migration.js";
import { loadWorkspaceEnvironment } from "../runtime/environment.js";

loadWorkspaceEnvironment();

const { DATABASE_MIGRATOR_URL: databaseUrl } = parseMigrationEnvironment();
await migrateDatabase({ databaseUrl, migrationsFolder: defaultMigrationsFolder });
await migrateJobs({ databaseUrl });
