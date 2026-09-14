import { z } from "zod";
import { parseEnvironment, resolveLoggingEnvironment, sharedEnvironmentShape } from "./shared.js";

export const adminProvisionEnvironmentSchema = z
  .object({
    ...sharedEnvironmentShape,
    DATABASE_RUNTIME_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    WEB_ORIGIN: z.url().default("http://localhost:5173"),
    PLATFORM_ADMIN_EMAIL: z.email(),
    PLATFORM_ADMIN_NAME: z.string().min(1),
    PLATFORM_ADMIN_PASSWORD: z.string().min(8),
  })
  .transform(resolveLoggingEnvironment);

export type AdminProvisionEnvironment = z.output<typeof adminProvisionEnvironmentSchema>;

export function parseAdminProvisionEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): AdminProvisionEnvironment {
  return parseEnvironment("Admin provision", adminProvisionEnvironmentSchema, source);
}
