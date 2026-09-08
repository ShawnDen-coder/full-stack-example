import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createOpenApiDocument } from "../../apps/api/src/openapi.js";

const output = path.join(import.meta.dirname, "..", "public", "generated", "openapi.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`, "utf8");
console.log(`Generated ${path.relative(process.cwd(), output)}`);
