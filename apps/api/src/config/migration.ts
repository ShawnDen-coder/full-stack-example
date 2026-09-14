import { z } from "zod";
import { parseEnvironment } from "./shared.js";

export const migrationEnvironmentSchema = z.object({
  DATABASE_MIGRATOR_URL: z.url(),
});

export type MigrationEnvironment = z.output<typeof migrationEnvironmentSchema>;

export function parseMigrationEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): MigrationEnvironment {
  return parseEnvironment("Migration", migrationEnvironmentSchema, source);
}
