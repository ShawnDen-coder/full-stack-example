import { Generator, getConfig } from "@tanstack/router-generator";

const root = process.cwd();
await new Generator({
	config: getConfig({ target: "react", autoCodeSplitting: true }, root),
	root,
}).run();
