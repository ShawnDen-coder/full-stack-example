// API-mocked interaction checks; real session isolation remains in playwright.config.ts.
import { defineConfig } from "@playwright/test";
export default defineConfig({
	testDir: "./tests",
	testMatch: "feedback.spec.ts",
	workers: 1,
	timeout: 30000,
	reporter: "list",
	use: {
		baseURL: "http://127.0.0.1:43101",
		channel: process.env.PLAYWRIGHT_CHANNEL,
		screenshot: "only-on-failure",
	},
	webServer: {
		command: "pnpm dev --host 127.0.0.1 --port 43101 --strictPort",
		url: "http://127.0.0.1:43101",
		env: { VITE_SERVER_URL: "http://127.0.0.1:43100" },
		reuseExistingServer: false,
	},
});
