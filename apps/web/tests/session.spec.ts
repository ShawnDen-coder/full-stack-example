import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";

const password = "playwright-test-password";
async function signup(page: Page, name: string) {
	const email = `${randomUUID()}@example.test`;
	await page.goto("/sign-in");
	await page.getByRole("button", { name: "Need an account? Sign Up" }).click();
	await page.getByLabel("Name", { exact: true }).fill(name);
	await page.getByLabel("Email", { exact: true }).fill(email);
	await page.getByLabel("Password", { exact: true }).fill(password);
	await page.getByRole("button", { name: "Sign Up", exact: true }).click();
	await expect(page).toHaveURL(/\/apps(?:\?|$)/);
	const session = await (
		await page.request.get("http://127.0.0.1:43100/api/auth/get-session")
	).json();
	execFileSync(
		"pnpm",
		[
			"--filter",
			"server",
			"exec",
			"tsx",
			"tests/workspace-browser-fixture.ts",
			session.user.id,
		],
		{
			cwd: fileURLToPath(new URL("../../../", import.meta.url)),
			env: process.env,
			stdio: "pipe",
		},
	);
	await page.goto("/apps?workspace=application");
	await page.getByRole("link", { name: "Todos", exact: true }).first().click();
	await expect(page).toHaveURL(/\/todos(?:\?|$)/);
	return email;
}
async function signout(page: Page, name: string) {
	await page.getByRole("button", { name, exact: true }).click();
	await page.getByRole("menuitem", { name: "Sign Out" }).click();
	await expect(
		page.getByRole("button", { name: "Sign In", exact: true }),
	).toBeVisible();
}

test("protected redirect, sign in return path, CRUD and account cache isolation", async ({
	page,
}) => {
	await page.goto("/todos");
	await expect(page).toHaveURL(/sign-in.*redirect/);
	const alice = await signup(page, "Alice");
	await page.getByRole("link", { name: "Todos", exact: true }).click();
	await page
		.getByRole("textbox", { name: "New task" })
		.fill("Alice private task");
	await page.getByRole("button", { name: "Add", exact: true }).click();
	await expect(
		page.getByText("Alice private task", { exact: true }),
	).toBeVisible();
	await page.getByRole("checkbox", { name: "Alice private task" }).click();
	await expect(
		page.getByRole("checkbox", { name: "Alice private task" }),
	).toBeChecked();
	await signout(page, "Alice");
	await signup(page, "Bob");
	// Capture every DOM update, including a single frame of stale private content.
	await page.evaluate(() => {
		const observer = new MutationObserver(() => {
			if (document.body.innerText.includes("Alice private task"))
				document.body.dataset.leaked = "true";
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			characterData: true,
		});
	});
	await page.route("**/rpc/todo/list**", async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 500));
		await route.continue();
	});
	await page.getByRole("link", { name: "Todos", exact: true }).click();
	await expect(page.getByText("No todos yet. Add one above!")).toBeVisible();
	await expect(page.locator("body")).not.toHaveAttribute("data-leaked", "true");
	await page.unroute("**/rpc/todo/list**");
	await signout(page, "Bob");
	await page.goto("/todos");
	await page.getByLabel("Email", { exact: true }).fill(alice);
	await page.getByLabel("Password", { exact: true }).fill(password);
	await page
		.locator("form")
		.getByRole("button", { name: "Sign In", exact: true })
		.click();
	await expect(page).toHaveURL(/\/todos(?:\?|$)/);
	await page.getByRole("button", { name: "Delete Alice private task" }).click();
	await expect(page.getByText("No todos yet. Add one above!")).toBeVisible();
});

test("failed writes are visible and session expiry removes protected content", async ({
	page,
	context,
}) => {
	await signup(page, "Failure test");
	await page.goto("/todos");
	await page.route("**/rpc/todo/create", (route) => route.abort("failed"));
	await page.getByRole("textbox", { name: "New task" }).fill("Keep this draft");
	await page.getByRole("button", { name: "Add", exact: true }).click();
	await expect(
		page
			.locator("[data-sonner-toast]")
			.filter({ hasText: /fetch|network|failed/i }),
	).toBeVisible();
	await expect(page.getByRole("textbox", { name: "New task" })).toHaveValue(
		"Keep this draft",
	);
	await page.unroute("**/rpc/todo/create");
	await context.clearCookies();
	await page.getByRole("button", { name: "Add", exact: true }).click();
	await expect(page).toHaveURL(/sign-in/);
	await expect(page.getByRole("textbox", { name: "New task" })).toHaveCount(0);
});

test("late responses from the previous account never repopulate its cache", async ({
	page,
}) => {
	await signup(page, "Late Alice");
	await page.goto("/todos");
	await page
		.getByRole("textbox", { name: "New task" })
		.fill("Late private task");
	await page.getByRole("button", { name: "Add", exact: true }).click();
	await expect(
		page.getByText("Late private task", { exact: true }),
	).toBeVisible();
	let release: () => void = () => {};
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	let captured: () => void = () => {};
	const capture = new Promise<void>((resolve) => {
		captured = resolve;
	});
	let firstResponse = true;
	await page.route("**/rpc/todo/list**", async (route) => {
		if (!firstResponse) {
			await route.continue();
			return;
		}
		firstResponse = false;
		const response = await route.fetch();
		captured();
		await held;
		await route.fulfill({ response }).catch(() => {});
	});
	await page
		.getByRole("link", { name: "Profile", exact: true })
		.first()
		.click();
	await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
	await page.getByRole("link", { name: "Todos", exact: true }).click();
	await capture;
	await signout(page, "Late Alice");
	await signup(page, "Late Bob");
	release();
	await page.unroute("**/rpc/todo/list**");
	await page.getByRole("link", { name: "Todos", exact: true }).click();
	await expect(page.getByText("No todos yet. Add one above!")).toBeVisible();
	await expect(
		page.getByText("Late private task", { exact: true }),
	).toHaveCount(0);
});

test("Todo editing supports validation, cancel, failed-write recovery and persistence", async ({
	page,
}, testInfo) => {
	await signup(page, "Editor");
	await page.getByRole("link", { name: "Todos", exact: true }).click();
	await page.getByRole("textbox", { name: "New task" }).fill("Original task");
	await page.getByRole("button", { name: "Add", exact: true }).click();
	await page
		.getByRole("button", { name: "Edit Original task", exact: true })
		.click();
	const input = page.getByRole("textbox", { name: "Task name", exact: true });
	await expect(input).toBeFocused();
	await input.fill("Discard this edit");
	await input.press("Escape");
	await expect(input).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Edit Original task", exact: true }),
	).toBeFocused();
	await page
		.getByRole("button", { name: "Edit Original task", exact: true })
		.click();
	await expect(input).toHaveValue("Original task");
	await input.fill("   ");
	await expect(input).toHaveAccessibleDescription("Enter a task name.");
	await expect(
		page.getByRole("button", { name: "Save", exact: true }),
	).toBeDisabled();
	await input.fill("x".repeat(501));
	await expect(input).toHaveAccessibleDescription(
		"Use 500 characters or fewer.",
	);
	await expect(
		page.getByRole("button", { name: "Save", exact: true }),
	).toBeDisabled();
	await input.fill("  Edited task  ");
	await page.route("**/rpc/todo/rename", (route) => route.abort("failed"));
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText(
		"Unable to save this task.",
	);
	await expect(input).toHaveValue("  Edited task  ");
	await expect(input).toBeEnabled();
	await expect(
		page
			.locator("[data-sonner-toast]")
			.filter({ hasText: /fetch|network|failed/i }),
	).toHaveCount(0);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.screenshot({ path: testInfo.outputPath("todo-edit-mobile.png") });
	await page.unroute("**/rpc/todo/rename");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(input).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Edit Edited task", exact: true }),
	).toBeFocused();
	await page.reload();
	await expect(page.getByText("Edited task", { exact: true })).toBeVisible();
	await expect(page.getByText("Original task", { exact: true })).toHaveCount(0);
	await page
		.getByRole("button", { name: "Edit Edited task", exact: true })
		.click();
	await input.fill("Another draft");
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(page.getByText("Edited task", { exact: true })).toBeVisible();
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.screenshot({
		path: testInfo.outputPath("todo-edited-desktop.png"),
	});
});

test("settings persist profile and theme, sidebar collapses and search navigates", async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await signup(page, "Settings tester");
	await page
		.getByRole("link", { name: "Profile", exact: true })
		.first()
		.click();
	await expect(page).toHaveURL(/\/settings(?:\?|$)/);
	await page.getByLabel("Name", { exact: true }).fill("Updated name");
	await page
		.getByRole("button", { name: "Update profile", exact: true })
		.click();
	await expect(
		page.getByText("Profile updated", { exact: true }),
	).toBeVisible();
	await page.reload();
	await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
		"Updated name",
	);
	await expect(
		page.getByRole("button", { name: "Updated name", exact: true }),
	).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath("profile-desktop.png") });
	await page
		.getByRole("main")
		.getByRole("link", { name: "Appearance", exact: true })
		.click();
	await page.getByText("Light", { exact: true }).click();
	await expect(page.locator("html")).not.toHaveClass(/dark/);
	await page.reload();
	await expect(
		page.getByRole("radio", { name: "Light", exact: true }),
	).toBeChecked();
	await page.screenshot({ path: testInfo.outputPath("appearance-light.png") });
	await page.getByText("Dark", { exact: true }).click();
	await expect(page.locator("html")).toHaveClass(/dark/);
	const toggle = page.locator('[data-sidebar="trigger"]');
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await page.reload();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await page.screenshot({
		path: testInfo.outputPath("appearance-dark-collapsed.png"),
	});
	await toggle.click();
	await page.getByRole("button", { name: /Search pages/ }).click();
	await page.getByRole("combobox").fill("Todos");
	await page.getByRole("option", { name: "Todos", exact: true }).click();
	await expect(page).toHaveURL(/\/todos(?:\?|$)/);
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.goto("/settings/profile");
	await expect(page).toHaveURL(/\/settings(?:\?|$)/);
	await page.goto("/todos");
	await expect(page).toHaveURL(/\/todos(?:\?|$)/);
});

test("legacy auth URLs preserve return paths and reject authentication loops", async ({
	page,
}) => {
	await page.goto("/login?redirect=%2Fsettings%2Fappearance");
	await expect(page).toHaveURL(/sign-in.*redirect/);
	await page.getByRole("button", { name: "Need an account? Sign Up" }).click();
	await expect(page).toHaveURL(/sign-up.*redirect/);
	await page.getByLabel("Name", { exact: true }).fill("Return path tester");
	await page
		.getByLabel("Email", { exact: true })
		.fill(`${randomUUID()}@example.test`);
	await page.getByLabel("Password", { exact: true }).fill(password);
	await page.getByRole("button", { name: "Sign Up", exact: true }).click();
	await expect(page).toHaveURL(/\/settings\/appearance$/);
	await page.goto("/sign-in?redirect=%2Fsign-up");
	await expect(page).toHaveURL(/\/apps(?:\?|$)/);
	await page.goto("/register?redirect=https%3A%2F%2Fexample.com");
	await expect(page).toHaveURL(/\/apps(?:\?|$)/);
});

test("round2: real sign-out cancels an authorized search transition", async ({
	page,
}) => {
	await signup(page, "Search owner");
	let hold = false;
	let release = () => {};
	let captured = () => {};
	let waiting = new Promise<void>((resolve) => {
		captured = resolve;
	});
	await page.route("**/rpc/access/me", async (route) => {
		if (hold) {
			captured();
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		}
		await route
			.fulfill({
				json: {
					json: {
						role: "user",
						organizationId: "application",
						platformRole: "superadmin",
						pages: ["queues", "apps", "todos"],
					},
				},
			})
			.catch(() => {});
	});
	const terms: string[] = [];
	await page.route("**/rpc/queues/jobs**", (route) => {
		terms.push(route.request().postDataJSON().json.query);
		return route.fulfill({
			json: {
				json: {
					mode: "name",
					items: [],
					scannedCount: 0,
					scanTruncated: false,
					resultsTruncated: false,
					refreshedAt: new Date().toISOString(),
				},
			},
		});
	});
	await page.goto("/queues/sample/jobs?mode=name&query=B");
	await expect(
		page.getByText("No matches in the searched range."),
	).toBeVisible();
	await page.getByRole("textbox", { name: "Full job name" }).fill("A");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect.poll(() => terms.length).toBe(2);
	await expect(
		page.getByRole("button", { name: "Search", exact: true }),
	).toBeEnabled();
	hold = true;
	waiting = new Promise<void>((resolve) => {
		captured = resolve;
	});
	await page.getByRole("textbox", { name: "Full job name" }).fill("B");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await waiting;
	await page.getByRole("button", { name: "Search owner", exact: true }).click();
	await page.getByRole("menuitem", { name: "Sign Out" }).click();
	await expect(
		page.getByRole("button", { name: "Sign In", exact: true }),
	).toBeVisible();
	hold = false;
	release();
	await page.waitForTimeout(300);
	expect(terms).toEqual(["B", "A"]);
	const cached = await page.evaluate(async () => {
		const { queryClient } = await new Function(
			'return import("/src/utils/orpc.ts")',
		)();
		return queryClient
			.getQueryCache()
			.getAll()
			.filter(
				(query: { meta?: { explicitQueueSearch?: boolean } }) =>
					query.meta?.explicitQueueSearch,
			).length;
	});
	expect(cached).toBe(0);
});

test("round2: late queue response from a signed-out owner cannot repopulate cache", async ({
	page,
}) => {
	await signup(page, "Queue owner");
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["queues", "apps", "todos"],
				},
			},
		}),
	);
	let release = () => {};
	let captured = () => {};
	const waiting = new Promise<void>((resolve) => {
		captured = resolve;
	});
	await page.route("**/rpc/queues/jobs**", async (route) => {
		captured();
		await new Promise<void>((resolve) => {
			release = resolve;
		});
		await route
			.fulfill({
				json: {
					json: {
						mode: "name",
						items: [],
						scannedCount: 0,
						scanTruncated: false,
						resultsTruncated: false,
						refreshedAt: new Date().toISOString(),
					},
				},
			})
			.catch(() => {});
	});
	await page.goto("/queues/sample/jobs?mode=name&query=late");
	await waiting;
	await page.getByRole("button", { name: "Queue owner", exact: true }).click();
	await page.getByRole("menuitem", { name: "Sign Out" }).click();
	await expect(
		page.getByRole("button", { name: "Sign In", exact: true }),
	).toBeVisible();
	release();
	await page.waitForTimeout(300);
	const cached = await page.evaluate(async () => {
		const { queryClient } = await new Function(
			'return import("/src/utils/orpc.ts")',
		)();
		return queryClient
			.getQueryCache()
			.getAll()
			.filter(
				(query: { meta?: { explicitQueueSearch?: boolean } }) =>
					query.meta?.explicitQueueSearch,
			).length;
	});
	expect(cached).toBe(0);
});
