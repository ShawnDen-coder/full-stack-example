import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createAuthModule } from "@full-stack-example/auth/server";
import { createDatabase } from "@full-stack-example/database";
import { configureLogging, getAppLogger, shutdownLogging } from "@full-stack-example/logging";
import { parseAdminProvisionConfig } from "./config.js";

const environmentFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const config = parseAdminProvisionConfig();
await configureLogging({
  service: "admin-provision",
  environment: config.environment,
  level: config.logLevel,
  pretty: config.pretty,
});
const logger = getAppLogger(["auth", "provision"]);
const database = createDatabase({
  databaseUrl: config.databaseRuntimeUrl,
  poolMax: config.databasePoolMax,
});

try {
  const auth = createAuthModule({
    database: database.db,
    baseURL: config.betterAuthUrl,
    secret: config.betterAuthSecret,
    trustedOrigins: [config.webOrigin],
  });
  const admin = await auth.ensurePlatformAdmin(config.platformAdmin);
  logger.info("Platform admin provisioning completed", {
    event: "auth.platform_admin.provisioned",
    userId: admin.id,
    created: admin.created,
  });
} catch (error) {
  logger.error("Platform admin provisioning failed", {
    event: "auth.platform_admin.provision_failed",
    error,
  });
  process.exitCode = 1;
} finally {
  try {
    await database.close();
  } finally {
    await shutdownLogging();
  }
}
