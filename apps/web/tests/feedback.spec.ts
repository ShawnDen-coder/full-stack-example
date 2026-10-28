import { expect, type Page, test } from "@playwright/test";

async function mockSession(
	page: Page,
	authenticated: boolean | (() => boolean) = true,
) {
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

test("keyboard navigation and form validation expose actionable errors", async ({
	page,
}, testInfo) => {
	await mockSession(page, false);
	await page.goto("/login");
	const skip = page.getByRole("link", { name: "Skip to main content" });
	await expect(skip).toBeAttached();
	await page.keyboard.press("Tab");
	await expect(skip).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("main")).toBeFocused();
	for (const mode of ["Sign In", "Sign Up"]) {
		if (mode === "Sign Up") {
			const switchMode = page.getByRole("button", {
				name: "Need an account? Sign Up",
			});
			await switchMode.focus();
			await switchMode.press("Enter");
		}
		await page
			.locator("form")
			.getByRole("button", { name: mode, exact: true })
			.click();
		const first = page.getByLabel(mode === "Sign In" ? "Email" : "Name", {
			exact: true,
		});
		await expect(first).toHaveAttribute("aria-invalid", "true");
		await expect(first).toBeFocused();
		await expect(first).toHaveAccessibleDescription(
			mode === "Sign In"
				? "Invalid email address"
				: "Name must be at least 2 characters",
		);
		await expect(
			page.getByLabel("Password", { exact: true }),
		).toHaveAccessibleDescription("Password must be at least 8 characters");
	}
	await page.screenshot({ path: testInfo.outputPath("form-desktop.png") });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.screenshot({ path: testInfo.outputPath("form-mobile.png") });
});

test("dashboard retries initial failure without a duplicate error toast", async ({
	page,
}) => {
	await mockSession(page);
	let failed = true;
	await page.route("**/rpc/privateData**", (route) =>
		failed
			? route.abort("failed")
			: route.fulfill({ json: { json: { message: "Dashboard recovered" } } }),
	);
	await page.goto("/dashboard");
	await expect(
		page.getByRole("status").filter({ hasText: "Loading dashboard" }),
	).toBeVisible();
	await expect(page.getByRole("alert")).toContainText(
		"Unable to load your dashboard.",
		{ timeout: 15000 },
	);
	await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
	failed = false;
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(page.getByText("API: Dashboard recovered")).toBeVisible();
	await expect(page.getByRole("alert")).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: "Dashboard", exact: true }),
	).toHaveAttribute("aria-current", "page");
	await expect(
		page.getByRole("link", { name: "Home", exact: true }),
	).not.toHaveAttribute("aria-current", "page");
});

test("Todo refresh failure preserves rows and draft, then recovers inline", async ({
	page,
}) => {
	await mockSession(page);
	let failed = false;
	await page.route("**/rpc/todo/list**", (route) =>
		failed
			? route.abort("failed")
			: route.fulfill({
					json: {
						json: {
							items: [
								{ id: 1, text: "Previously loaded task", completed: false },
							],
							nextCursor: null,
						},
					},
				}),
	);
	await page.route("**/rpc/todo/setCompleted**", (route) => {
		failed = true;
		return route.fulfill({
			json: {
				json: { id: 1, text: "Previously loaded task", completed: true },
			},
		});
	});
	await page.goto("/todos");
	await expect(
		page.getByText("Previously loaded task", { exact: true }),
	).toBeVisible();
	await page.getByRole("textbox", { name: "New task" }).fill("Preserved draft");
	await page.getByRole("checkbox", { name: "Previously loaded task" }).click();
	await expect(page.getByRole("alert")).toContainText(
		"Showing previously loaded tasks.",
		{ timeout: 15000 },
	);
	await expect(
		page.getByText("Previously loaded task", { exact: true }),
	).toBeVisible();
	await expect(page.getByRole("textbox", { name: "New task" })).toHaveValue(
		"Preserved draft",
	);
	await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
	failed = false;
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(page.getByRole("alert")).toHaveCount(0);
	await expect(page.getByRole("textbox", { name: "New task" })).toBeEnabled();
});

test("locally handled query errors still clear an expired session", async ({
	page,
}) => {
	let authenticated = true;
	let expired = false;
	await mockSession(page, () => authenticated);
	await page.route("**/rpc/todo/list**", (route) => {
		if (expired) {
			authenticated = false;
			return route.fulfill({
				status: 401,
				json: {
					json: {
						defined: false,
						code: "UNAUTHORIZED",
						status: 401,
						message: "Unauthorized",
					},
				},
			});
		}
		return route.fulfill({
			json: {
				json: {
					items: [{ id: 1, text: "Private task", completed: false }],
					nextCursor: null,
				},
			},
		});
	});
	await page.route("**/rpc/todo/setCompleted**", (route) => {
		expired = true;
		return route.fulfill({
			json: { json: { id: 1, text: "Private task", completed: true } },
		});
	});
	await page.goto("/todos");
	await page.getByRole("checkbox", { name: "Private task" }).click();
	await expect(page).toHaveURL(/login/);
	await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
	await expect(page.getByText("Private task", { exact: true })).toHaveCount(0);
});
