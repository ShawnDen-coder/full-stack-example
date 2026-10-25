import { readFile } from "node:fs/promises";
import { HEARTBEAT_FILE } from "./heartbeat";

try {
	const { timestamp } = JSON.parse(await readFile(HEARTBEAT_FILE, "utf8"));
	if (
		typeof timestamp !== "number" ||
		Date.now() - timestamp > 15000 ||
		timestamp > Date.now()
	)
		process.exitCode = 1;
} catch {
	process.exitCode = 1;
}
