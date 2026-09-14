import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_MIGRATOR_URL ?? "postgres://app_migrator:migrator@localhost:5432/app",
  },
});
