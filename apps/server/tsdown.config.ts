import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/migrate.ts", "./src/provision-db.ts"],
	format: "esm",
	outDir: "./dist",
	clean: true,
	deps: {
		alwaysBundle: [/@my-better-t-app\/.*/],
		neverBundle: ["pino", "pg", "bullmq", "bullmq-otel"],
	},
});
