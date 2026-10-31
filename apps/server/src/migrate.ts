import { runMigrations } from "@full-stack-example/runtime/deployment";

try {
	await runMigrations(process.env);
} catch {
	process.exitCode = 1;
}
