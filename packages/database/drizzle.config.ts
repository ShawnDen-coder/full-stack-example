import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";
import { z } from "zod";

const environmentFile = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const environmentSchema = z.object({ DATABASE_MIGRATOR_URL: z.url() });
const result = environmentSchema.safeParse(process.env);
if (!result.success)
  throw new Error(
    `Invalid Drizzle Kit environment:\n- DATABASE_MIGRATOR_URL: ${
      process.env.DATABASE_MIGRATOR_URL?.trim() ? "must be a valid URL" : "is required"
    }`,
  );

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: result.data.DATABASE_MIGRATOR_URL,
  },
});
