import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

const password = "playwright-test-password";
async function signup(page: Page, name: string) {
	const email = `${randomUUID()}@example.test`;
	await page.goto("/login");
	await page.getByRole("button", { name: "Need an account? Sign Up" }).click();
	await page.getByLabel("Name", { exact: true }).fill(name);
	await page.getByLabel("Email", { exact: true }).fill(email);
	await page.getByLabel("Password", { exact: true }).fill(password);
	await page.getByRole("button", { name: "Sign Up", exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
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
	await expect(page).toHaveURL(/login.*redirect/);
	const alice = await signup(page, "Alice");
	await page.getByRole("link", { name: "Todos" }).click();
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
	await page.getByRole("link", { name: "Todos" }).click();
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
	await expect(page).toHaveURL(/\/todos$/);
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
	await expect(page).toHaveURL(/login/);
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
	await page.route("**/rpc/todo/list**", async (route) => {
		const response = await route.fetch();
		captured();
		await held;
		await route.fulfill({ response }).catch(() => {});
	});
	await page.getByRole("link", { name: "Dashboard" }).click();
	await page.getByRole("link", { name: "Todos" }).click();
	await capture;
	await signout(page, "Late Alice");
	await signup(page, "Late Bob");
	release();
	await page.unroute("**/rpc/todo/list**");
	await page.getByRole("link", { name: "Todos" }).click();
	await expect(page.getByText("No todos yet. Add one above!")).toBeVisible();
	await expect(
		page.getByText("Late private task", { exact: true }),
	).toHaveCount(0);
});
