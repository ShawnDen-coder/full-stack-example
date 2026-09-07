import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootstrap } from "./bootstrap.js";

const environmentFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

let shutdown: (() => Promise<void>) | undefined;
try {
  shutdown = await bootstrap();
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => void shutdown?.().finally(() => process.exit(0)));
  }
} catch (error) {
  console.error("API startup failed", error);
  process.exitCode = 1;
}
