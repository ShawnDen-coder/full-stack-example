import { createAuthModule } from "@full-stack-example/auth/server";
import { createDatabase } from "@full-stack-example/database";
import { configureLogging, getAppLogger, shutdownLogging } from "@full-stack-example/logging";
import { parseAdminProvisionEnvironment } from "../config/admin-provision.js";
import { loadWorkspaceEnvironment } from "../runtime/environment.js";

loadWorkspaceEnvironment();

const config = parseAdminProvisionEnvironment();
await configureLogging({
  service: "admin-provision",
  environment: config.NODE_ENV,
  level: config.LOG_LEVEL,
  pretty: config.LOG_PRETTY,
});
const logger = getAppLogger(["auth", "provision"]);
const database = createDatabase({
  databaseUrl: config.DATABASE_RUNTIME_URL,
  poolMax: config.DATABASE_POOL_MAX,
});

try {
  const auth = createAuthModule({
    database: database.db,
    baseURL: config.BETTER_AUTH_URL,
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [config.WEB_ORIGIN],
  });
  const admin = await auth.ensurePlatformAdmin({
    email: config.PLATFORM_ADMIN_EMAIL,
    name: config.PLATFORM_ADMIN_NAME,
    password: config.PLATFORM_ADMIN_PASSWORD,
  });
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
