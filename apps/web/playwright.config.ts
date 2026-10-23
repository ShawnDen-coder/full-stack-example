import { defineConfig } from "@playwright/test";

const database = process.env.TEST_DATABASE_URL;
const redis = process.env.TEST_REDIS_URL;
if (!database || !redis)
	throw new Error(
		"TEST_DATABASE_URL and TEST_REDIS_URL must target dedicated test services",
	);
const env = {
	NODE_ENV: "test",
	DATABASE_URL: database,
	REDIS_URL: redis,
	BETTER_AUTH_SECRET: "playwright-only-secret-at-least-32-characters",
	BETTER_AUTH_URL: "http://127.0.0.1:43100",
	CORS_ORIGIN: "http://127.0.0.1:43101",
	PORT: "43100",
	VITE_SERVER_URL: "http://127.0.0.1:43100",
};
export default defineConfig({
	testDir: "./tests",
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	timeout: 90000,
	use: { baseURL: "http://127.0.0.1:43101", trace: "retain-on-failure" },
	reporter: [["list"], ["html", { open: "never" }]],
	webServer: [
		{
			command: "pnpm db:migrate && pnpm --filter server exec tsx src/index.ts",
			cwd: "../..",
			url: "http://127.0.0.1:43100/ready",
			env,
			reuseExistingServer: false,
		},
		{
			command: "pnpm dev --host 127.0.0.1 --port 43101 --strictPort",
			url: "http://127.0.0.1:43101",
			env,
			reuseExistingServer: false,
		},
	],
});
