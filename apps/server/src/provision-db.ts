import { provisionDatabase } from "@full-stack-example/runtime/deployment";

try {
	await provisionDatabase(process.env);
} catch {
	process.exitCode = 1;
}
