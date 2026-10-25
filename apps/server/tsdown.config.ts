import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/migrate.ts", "./src/provision-db.ts"],
	format: "esm",
	outDir: "./dist",
	clean: true,
	deps: {
		alwaysBundle: [/@full-stack-example\/.*/],
		neverBundle: ["pino", "pg", "bullmq", "bullmq-otel"],
	},
});
