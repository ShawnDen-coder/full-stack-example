import { parseApiEnvironment } from "../config/api.js";
import { startApiServer } from "../runtime/api-server.js";
import { discardPrivilegedEnvironment, loadWorkspaceEnvironment } from "../runtime/environment.js";

loadWorkspaceEnvironment();
discardPrivilegedEnvironment();

try {
  const runtime = await startApiServer(parseApiEnvironment());
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void runtime.close().catch(() => {
        process.exitCode = 1;
      });
    });
  }
} catch (error) {
  console.error("API startup failed", error);
  process.exitCode = 1;
}
