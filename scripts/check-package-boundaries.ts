import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoots = [resolve(root, "apps"), resolve(root, "packages")];
const importPattern = /(?:from\s+|import\s*\()(["'])([^"']+)\1/g;
const violations: string[] = [];

async function checkFile(path: string) {
  const source = await readFile(path, "utf8");
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[2];
    if (!specifier) continue;
    const relative = path.slice(root.length + 1).replaceAll("\\", "/");
    if (relative.startsWith("apps/web/") &&
      (specifier.startsWith("@full-stack-example/auth/server") ||
        specifier.startsWith("@full-stack-example/database") ||
        specifier.startsWith("node:"))) {
      violations.push(`${relative}: forbidden Web import ${specifier}`);
    }
    if (relative.startsWith("packages/") && specifier.startsWith("@full-stack-example/api")) {
      violations.push(`${relative}: package imports app ${specifier}`);
    }
    if (relative.startsWith("packages/") && specifier.includes("/src/")) {
      violations.push(`${relative}: source-path import ${specifier}`);
    }
  }
}

async function walk(directory: string): Promise<void> {
  const entries = await (await import("node:fs/promises")).readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") await walk(path);
    else if (entry.isFile() && /\.(ts|tsx|mts|cts)$/.test(entry.name)) await checkFile(path);
  }
}

for (const rootDirectory of sourceRoots) await walk(rootDirectory);
if (violations.length) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
}
