import { expect, type Page, test } from "@playwright/test";

async function mockSession(
	page: Page,
	authenticated: boolean | (() => boolean) = true,
) {
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					pages: ["todos", "dashboard", "tasks", "apps", "chats"],
				},
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

test("keyboard navigation and form validation expose actionable errors", async ({
	page,
}, testInfo) => {
	await mockSession(page, false);
	await page.goto("/sign-in");
	await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
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

test("dashboard shows the upstream overview", async ({ page }) => {
	await mockSession(page);
	await page.route("**/rpc/todo/list**", (route) =>
		route.fulfill({ json: { json: { items: [], nextCursor: null } } }),
	);
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/dashboard$/);
	await expect(
		page.getByRole("link", { name: "Dashboard", exact: true }),
	).toHaveAttribute("aria-current", "page");
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
	await expect(page).toHaveURL(/sign-in/);
	await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
	await expect(page.getByText("Private task", { exact: true })).toHaveCount(0);
});

test("saved task text survives a failed refresh and duplicate saves are blocked", async ({
	page,
}) => {
	await mockSession(page);
	let saved = false;
	let writes = 0;
	let release = () => {};
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/rpc/todo/list**", (route) =>
		saved
			? route.abort("failed")
			: route.fulfill({
					json: {
						json: {
							items: [{ id: 1, text: "Before edit", completed: false }],
							nextCursor: null,
						},
					},
				}),
	);
	await page.route("**/rpc/todo/rename", async (route) => {
		writes++;
		await held;
		saved = true;
		await route.fulfill({
			json: { json: { id: 1, text: "Saved edit", completed: false } },
		});
	});
	await page.goto("/todos");
	await page
		.getByRole("button", { name: "Edit Before edit", exact: true })
		.click();
	await page
		.getByRole("textbox", { name: "Task name", exact: true })
		.fill("Saved edit");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Saving...", exact: true }),
	).toBeDisabled();
	await expect(
		page.getByRole("button", { name: "Cancel", exact: true }),
	).toBeDisabled();
	await expect(
		page.getByRole("textbox", { name: "Task name", exact: true }),
	).toBeDisabled();
	await page.keyboard.press("Enter");
	release();
	await expect(
		page.getByRole("button", { name: "Edit Saved edit", exact: true }),
	).toBeVisible({ timeout: 15000 });
	await expect(page.getByRole("alert")).toContainText(
		"Showing previously loaded tasks.",
	);
	await expect(page.getByText("Before edit", { exact: true })).toHaveCount(0);
	expect(writes).toBe(1);
});

test("upstream pages render, filters follow history and task dialogs work", async ({
	page,
}, testInfo) => {
	await mockSession(page);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.addInitScript(() =>
		localStorage.setItem("vite-ui-theme", "light"),
	);
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/dashboard");
	// Select the persisted appearance through the actual UI.
	await page.goto("/settings/appearance");
	await page.getByText("Light", { exact: true }).click();
	await page.getByRole("link", { name: "Dashboard", exact: true }).click();
	await expect(page.getByText("Total Revenue", { exact: true })).toBeVisible();
	await expect(page.locator(".recharts-surface").first()).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath("dashboard-desktop.png") });
	await page.getByRole("tab", { name: "Analytics", exact: true }).click();
	await expect(
		page.getByText("Traffic Overview", { exact: true }),
	).toBeVisible();
	await page.getByRole("link", { name: "Apps", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "App Integrations" }),
	).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath("apps-desktop.png") });
	const appFilter = page.getByPlaceholder("Filter apps...");
	await appFilter.fill("GitHub");
	await expect(
		page.getByRole("heading", { name: "GitHub", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Discord", exact: true }),
	).toHaveCount(0);
	await appFilter.fill("Discord");
	await expect(
		page.getByRole("heading", { name: "Discord", exact: true }),
	).toBeVisible();
	await page.goBack();
	await expect(appFilter).toHaveValue("GitHub");
	await page.getByRole("link", { name: "Tasks", exact: true }).click();
	await expect(page.getByRole("table")).toBeVisible();
	await expect(page.getByRole("row")).toHaveCount(11);
	await page.screenshot({ path: testInfo.outputPath("tasks-desktop.png") });
	const taskFilter = page.getByPlaceholder("Filter by title or ID...");
	await taskFilter.fill("no-task-matches-this");
	await expect(page.getByText("No results.", { exact: true })).toBeVisible();
	await page.goBack();
	await expect(taskFilter).toHaveValue("");
	await expect(page.getByRole("row")).toHaveCount(11);
	await page.getByRole("button", { name: "Create", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Create Task" })).toBeVisible();
	await page.getByRole("button", { name: "Save changes", exact: true }).click();
	await expect(
		page.getByText("Title is required.", { exact: true }),
	).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath("tasks-create.png") });
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Import", exact: true }).click();
	await expect(
		page.getByRole("dialog", { name: "Import Tasks" }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("checkbox", { name: "Select row" }).first().click();
	await expect(
		page.getByRole("button", { name: "Delete selected tasks" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Delete selected tasks" }).click();
	await expect(page.getByRole("alertdialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await page.goto("/settings/appearance");
	await page.getByText("Dark", { exact: true }).click();
	await page.getByRole("link", { name: "Tasks", exact: true }).click();
	await page.locator('[data-sidebar="trigger"]').click();
	await expect(page.locator('[data-sidebar="trigger"]')).toHaveAttribute(
		"aria-expanded",
		"false",
	);
	await page.screenshot({
		path: testInfo.outputPath("tasks-dark-collapsed.png"),
	});
	expect(errors).toEqual([]);
});

test("ordinary users keep settings but cannot enter administration", async ({
	page,
}) => {
	await mockSession(page);
	await page.goto("/settings/appearance");
	await expect(
		page.getByRole("link", { name: "Users", exact: true }),
	).toHaveCount(0);
	await page.goto("/admin/users");
	await expect(page).toHaveURL(/\/no-access$/);
	await expect(
		page.getByRole("heading", { name: "Page access required" }),
	).toBeVisible();
	await page.getByRole("link", { name: "Account settings" }).click();
	await expect(page).toHaveURL(/\/settings\/account$/);
});
