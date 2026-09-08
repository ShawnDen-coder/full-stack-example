import { spawn } from "node:child_process";
import path from "node:path";

const docsDirectory = path.resolve(import.meta.dirname, "..");
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: docsDirectory,
      env: { ...process.env, DOCS_BASE: "/" },
      shell: process.platform === "win32",
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

await run(["build"]);
await run(["exec", "rspress", "preview"]);
