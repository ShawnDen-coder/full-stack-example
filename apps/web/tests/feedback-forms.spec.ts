import { expect, test } from "@playwright/test";
import { mockSession } from "./feedback-fixtures";

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
	await page
		.getByRole("link", { name: "Dashboard example", exact: true })
		.click();
	await expect(page.getByText("Total Revenue", { exact: true })).toBeVisible();
	await expect(page.locator(".recharts-surface").first()).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath("dashboard-desktop.png") });
	await page.getByRole("tab", { name: "Analytics", exact: true }).click();
	await expect(
		page.getByText("Traffic Overview", { exact: true }),
	).toBeVisible();
	await page
		.getByRole("link", { name: "Integration examples", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Integration examples" }),
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
	await page.getByRole("link", { name: "Tasks example", exact: true }).click();
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
	await page.getByRole("link", { name: "Tasks example", exact: true }).click();
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

test("tool home, sidebar and search share tool visibility; platform tools stay separate", async ({
	page,
}) => {
	await mockSession(page);
	let pages: string[] = [];
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages,
				},
			},
		}),
	);
	for (const enabled of [false, true]) {
		pages = enabled ? ["todos"] : [];
		await page.goto(
			"/apps?workspace=application&type=connected&filter=old&sort=asc",
		);
		await expect(page).toHaveURL(/\/apps\?workspace=application$/);
		await expect(
			page
				.getByRole("main")
				.getByRole("button", { name: "Todos", exact: true }),
		).toHaveCount(enabled ? 1 : 0);
		await expect(
			page.getByRole("main").getByRole("button", { name: "Queues" }),
		).toHaveCount(0);
		await expect(
			page.getByRole("link", { name: "Todos", exact: true }),
		).toHaveCount(enabled ? 1 : 0);
		await expect(
			page.getByRole("link", { name: "Queues", exact: true }),
		).toHaveCount(1);
		await page.getByRole("button", { name: "Search pages" }).click();
		await expect(
			page.getByRole("option", { name: "Todos", exact: true }),
		).toHaveCount(enabled ? 1 : 0);
		await expect(
			page.getByRole("option", { name: "Queues", exact: true }),
		).toHaveCount(1);
		await page.keyboard.press("Escape");
	}
});

test("round1 candidates A and B: role dialogs restore focus and fit many roles", async ({
	page,
}) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "admin",
					organizationId: "application",
					workspaceRole: "owner",
					pages: [],
				},
			},
		}),
	);
	await page.route("**/api/auth/organization/list-members**", (route) =>
		route.fulfill({
			json: {
				members: [
					{
						id: "member1",
						role: "member",
						user: { name: "Person", email: "person@example.test" },
					},
				],
				total: 1,
			},
		}),
	);
	await page.route("**/api/auth/organization/list-roles**", (route) =>
		route.fulfill({
			json: Array.from({ length: 30 }, (_, i) => ({
				id: `r${i}`,
				role: `role-${i}`,
				permission: {},
			})),
		}),
	);
	await page.route("**/api/auth/organization/update-member-role", (route) =>
		route.fulfill({ json: { id: "member1", role: "member" } }),
	);
	await page.setViewportSize({ width: 390, height: 600 });
	await page.goto("/admin/users");
	const trigger = page.getByRole("button", {
		name: "Edit roles for person@example.test",
	});
	await trigger.click();
	const dialog = page.getByRole("dialog");
	const save = dialog.getByRole("button", { name: "Save changes" });
	await expect(dialog.getByRole("checkbox", { name: "role-0" })).toBeVisible();
	await dialog
		.getByRole("checkbox", { name: "role-29" })
		.scrollIntoViewIfNeeded();
	await save.scrollIntoViewIfNeeded();
	const bounds = await save.boundingBox();
	expect(
		bounds && bounds.y >= 0 && bounds.y + bounds.height <= 600,
	).toBeTruthy();
	await dialog.getByRole("button", { name: "Cancel" }).click();
	await expect(trigger).toBeFocused();
	await trigger.click();
	await page.keyboard.press("Escape");
	await expect(trigger).toBeFocused();
	await trigger.click();
	await save.click();
	await expect(dialog).toHaveCount(0);
	await expect(trigger).toBeFocused();
	await page.getByRole("tab", { name: "Page roles" }).click();
	const create = page.getByRole("button", { name: "Create role" });
	await create.click();
	await page.keyboard.press("Escape");
	await expect(create).toBeFocused();
});

test("long tasks and actions remain inside a narrow workspace", async ({
	page,
}, info) => {
	await mockSession(page);
	const text = "LongUnbrokenTask".repeat(20);
	await page.route("**/rpc/todo/list**", (route) =>
		route.fulfill({
			json: {
				json: { items: [{ id: 1, text, completed: false }], nextCursor: null },
			},
		}),
	);
	await page.setViewportSize({ width: 320, height: 600 });
	await page.goto("/todos?workspace=application");
	const row = page.getByRole("listitem").filter({ has: page.getByText(text) });
	await expect(row).toBeVisible();
	const box = await row.boundingBox();
	const edit = row.getByRole("button", { name: `Edit ${text}` });
	const actionBox = await edit.boundingBox();
	if (!box || !actionBox) throw new Error("Task bounds unavailable");
	expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(box.x + box.width);
	await edit.click();
	await expect(page.getByLabel("Task name")).toBeFocused();
	await expect(
		page.getByRole("button", { name: "Save", exact: true }),
	).toBeVisible();
	await page.screenshot({ path: info.outputPath("todos-320-edit.png") });
});
