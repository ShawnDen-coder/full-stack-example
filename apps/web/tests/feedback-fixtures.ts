import type { Page } from "@playwright/test";

export async function mockSession(
	page: Page,
	authenticated: boolean | (() => boolean) = true,
) {
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					pages: ["todos", "dashboard", "tasks", "apps", "chats"],
				},
			},
		}),
	);
	await page.route("**/rpc/queues/list**", (route) =>
		route.fulfill({ json: { json: [] } }),
	);
	await page.route("**/rpc/access/mine", (route) =>
		route.fulfill({
			json: {
				json: [{ id: "application", name: "Application", slug: "application" }],
			},
		}),
	);
	const date = new Date().toISOString();
	await page.route("**/api/auth/**", (route) =>
		route.fulfill({
			json: (
				typeof authenticated === "function"
					? authenticated()
					: authenticated
			)
				? {
						user: {
							id: "feedback-user",
							name: "Feedback tester",
							email: "feedback@example.test",
							emailVerified: true,
							createdAt: date,
							updatedAt: date,
						},
						session: {
							id: "feedback-session",
							userId: "feedback-user",
							token: "test-only",
							expiresAt: new Date(Date.now() + 3600000).toISOString(),
							createdAt: date,
							updatedAt: date,
						},
					}
				: null,
		}),
	);
}

export const browserJob = {
	id: "job-123456789012345678901234",
	name: "profile",
	state: "failed",
	attemptsMade: 2,
	attemptsConfigured: 3,
	timestamp: 1700000000000,
	processedOn: null,
	finishedOn: 1700000001000,
	failedReason: "Worker could not read profile",
	summary: { userId: "user-123" },
};
