import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Module = {
  readonly directory: string;
  readonly route: string;
  readonly title: string;
  readonly source: string;
};

const repository = "https://github.com/ShawnDen-coder/full-stack-example";
const docsDirectory = path.resolve(import.meta.dirname, "..");
const rootDirectory = path.resolve(docsDirectory, "..");
const modules: readonly Module[] = [
  { directory: "apps/api", route: "api", title: "API 应用", source: "apps/api/README.md" },
  { directory: "apps/web", route: "web", title: "Web 应用", source: "apps/web/README.md" },
  {
    directory: "packages/api-client",
    route: "api-client",
    title: "API Client 包",
    source: "packages/api-client/README.md",
  },
  {
    directory: "packages/database",
    route: "database",
    title: "Database 包",
    source: "packages/database/README.md",
  },
  {
    directory: "packages/logging",
    route: "logging",
    title: "Logging 包",
    source: "packages/logging/README.md",
  },
  {
    directory: "packages/system",
    route: "system",
    title: "System 包",
    source: "packages/system/README.md",
  },
  {
    directory: "packages/todos",
    route: "todos",
    title: "Todos 包",
    source: "packages/todos/README.md",
  },
];

function stripHeading(markdown: string) {
  return markdown.replace(/^# .+\r?\n+/, "").trimStart();
}

function sourceLink(source: string) {
  return `${repository}/blob/master/${source}`;
}

async function readModule(module: Module) {
  const packageJson = JSON.parse(
    await readFile(path.join(rootDirectory, module.directory, "package.json"), "utf8"),
  ) as {
    description?: string;
  };
  if (!packageJson.description) throw new Error(`Missing package description: ${module.directory}`);
  const sourcePath = path.join(rootDirectory, module.source);
  const markdown = await readFile(sourcePath, "utf8");
  const requiredSections = ["## Development", "## Extension rules"];
  for (const section of requiredSections) {
    if (!markdown.includes(section)) throw new Error(`${module.source} is missing ${section}`);
  }
  if (!markdown.includes("## Responsibilities") && !markdown.includes("## Public API")) {
    throw new Error(`${module.source} is missing ## Responsibilities or ## Public API`);
  }
  return `---\ntitle: ${module.title}\ndescription: ${packageJson.description}\n---\n\n> 内容来源：[${module.source}](${sourceLink(module.source)})。\n\n${stripHeading(markdown)}\n`;
}

const modulesDirectory = path.join(docsDirectory, "content", "modules");
await mkdir(modulesDirectory, { recursive: true });
for (const module of modules) {
  await writeFile(
    path.join(modulesDirectory, `${module.route}.mdx`),
    await readModule(module),
    "utf8",
  );
}

const rootReadme = await readFile(path.join(rootDirectory, "README.md"), "utf8");
await writeFile(
  path.join(docsDirectory, "content", "guide", "project-overview.mdx"),
  `---\ntitle: 项目概览\ndescription: 全栈示例 monorepo 的技术栈、目录边界、开发命令、部署方式和运行时约束。\n---\n\n> 内容来源：[根 README](${repository})。\n\n${stripHeading(rootReadme)}\n`,
  "utf8",
);

console.log(`Synced ${modules.length} module READMEs and the project overview.`);
