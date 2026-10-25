import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

// Development only. Exclusive creation preserves every existing configuration.
const files = {
	"apps/server/.env": `DATABASE_URL=postgresql://postgres:password@localhost:5432/full-stack-example\nBETTER_AUTH_URL=http://localhost:3000\nCORS_ORIGIN=http://localhost:3001\nBETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\n`,
	"apps/worker/.env":
		"DATABASE_URL=postgresql://postgres:password@localhost:5432/full-stack-example\n",
	"apps/web/.env": "VITE_SERVER_URL=http://localhost:3000\n",
};
for (const [path, value] of Object.entries(files)) {
	try {
		await writeFile(new URL(`../${path}`, import.meta.url), value, {
			flag: "wx",
			mode: 0o600,
		});
		console.log(`Created ${path}`);
	} catch (error) {
		if (error.code !== "EEXIST") throw error;
		console.log(`Preserved ${path}`);
	}
}
