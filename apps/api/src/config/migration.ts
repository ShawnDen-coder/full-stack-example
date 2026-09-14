import { z } from "zod";

export function parseMigrationConfig(environment: NodeJS.ProcessEnv = process.env): {
  readonly databaseUrl: string;
} {
  const value = environment.DATABASE_MIGRATOR_URL;
  if (!value) throw new Error("DATABASE_MIGRATOR_URL is required for migrations");
  return { databaseUrl: z.url().parse(value) };
}
