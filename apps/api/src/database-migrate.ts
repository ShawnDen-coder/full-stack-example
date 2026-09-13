import { defaultMigrationsFolder, migrateDatabase } from "@full-stack-example/database";
import { parseMigrationConfig } from "./config.js";

const config = parseMigrationConfig();
await migrateDatabase({
  databaseUrl: config.databaseUrl,
  migrationsFolder: defaultMigrationsFolder,
});
