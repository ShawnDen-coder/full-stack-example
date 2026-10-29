import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { expect, type Route, test } from "@playwright/test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
test("create workspaces, use cards and keep Todo data scoped when switching", async ({
	page,
	playwright,
	browser,
}, info) => {
	const email = `${randomUUID()}@example.test`;
	const password = "workspace-browser-test-password";
	const request = await playwright.request.newContext();
	const response = await request.post(
		"http://127.0.0.1:43100/api/auth/sign-up/email",
		{
			headers: { Origin: "http://127.0.0.1:43101" },
			data: { name: "Workspace tester", email, password },
		},
	);
	expect(response.ok()).toBeTruthy();
	const { user } = await response.json();
	await request.dispose();
	try {
		execFileSync("pnpm", ["admin:bootstrap", user.id], {
			cwd: root,
			env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
			stdio: "pipe",
		});
		await page.goto("/sign-in");
		await page.getByLabel("Email", { exact: true }).fill(email);
		await page.getByLabel("Password", { exact: true }).fill(password);
		await page.getByRole("button", { name: "Sign In", exact: true }).click();
		await expect(page).toHaveURL(/\/apps(?:\?|$)/);
		const spaces: Array<{ name: string; id: string }> = [];
		for (const suffix of ["A", "B"]) {
			await page.goto("/workspaces");
			await page
				.getByRole("button", { name: "New workspace", exact: true })
				.click();
			await page
				.getByLabel("Name", { exact: true })
				.fill(`Workspace ${suffix}`);
			await page
				.getByLabel("Slug", { exact: true })
				.fill(`browser-${randomUUID()}`);
			await page.getByLabel("Owner email").fill(email);
			await page
				.getByRole("button", { name: "Create workspace", exact: true })
				.click();
			await expect(page.getByRole("dialog")).toHaveCount(0);
			await page.getByRole("button", { name: "Switch workspace" }).click();
			await page
				.getByRole("menuitemradio", {
					name: `Workspace ${suffix}`,
					exact: true,
				})
				.click();
			await expect(
				page.getByRole("button", { name: "Todos", exact: true }),
			).toBeVisible();
			spaces.push({
				name: `Workspace ${suffix}`,
				id: new URL(page.url()).searchParams.get("workspace") ?? "",
			});
		}
		const a = spaces[0];
		const b = spaces[1];
		if (!a || !b) throw new Error("Expected two workspaces");
		await page.goto(`/apps?workspace=${a.id}`);
		const card = page.getByRole("button", { name: "Todos", exact: true });
		await card.click();
		await expect(page).toHaveURL(/\/apps\?/);
		await card.dblclick();
		await expect(page).toHaveURL(/\/todos\?/);
		await expect(
			page.getByRole("link", { name: "Todos", exact: true }),
		).toHaveAttribute("aria-current", "page");
		await page.getByLabel("New task").fill("Only in workspace A");
		await page.getByRole("button", { name: "Add", exact: true }).click();
		await expect(
			page.getByText("Only in workspace A", { exact: true }),
		).toBeVisible();
		await page.getByRole("button", { name: "Switch workspace" }).click();
		await page
			.getByRole("menuitemradio", { name: b.name, exact: true })
			.click();
		await page.getByRole("button", { name: "Todos", exact: true }).focus();
		await page.keyboard.press("Enter");
		await expect(page.getByText("No todos yet. Add one above!")).toBeVisible();
		await expect(
			page.getByText("Only in workspace A", { exact: true }),
		).toHaveCount(0);
		// Another tab keeps its explicit workspace even after this tab switches.
		const other = await page.context().newPage();
		await other.goto(`/todos?workspace=${a.id}`);
		await expect(
			other.getByText("Only in workspace A", { exact: true }),
		).toBeVisible();
		await other.close();
		// Delay a real scope's list response until after another workspace is displayed.
		await page.goto(`/apps?workspace=${a.id}`);
		let pending: Route | undefined;
		await page.route("**/rpc/todo/list", async (route) => {
			if (route.request().postDataJSON().json.workspaceId === a.id)
				pending = route;
			else await route.continue();
		});
		await page.getByRole("link", { name: "Todos", exact: true }).click();
		await expect.poll(() => Boolean(pending)).toBe(true);
		await page.getByRole("button", { name: /Switch workspace/ }).click();
		await page
			.getByRole("menuitemradio", { name: b.name, exact: true })
			.click();
		await page
			.getByRole("button", { name: "Todos", exact: true })
			.press("Enter");
		await expect(page.getByText("No todos yet. Add one above!")).toBeVisible();
		if (!pending) throw new Error("Expected a delayed request");
		await pending
			.fulfill({
				json: {
					json: {
						items: [
							{ id: 999, text: "Late workspace A result", completed: false },
						],
						nextCursor: null,
					},
				},
			})
			.catch(() => {});
		await expect(page.getByText("Late workspace A result")).toHaveCount(0);
		await page.unroute("**/rpc/todo/list");

		await page.goto(`/apps?workspace=${b.id}`);
		for (const width of [1440, 768, 390]) {
			await page.setViewportSize({ width, height: 1000 });
			await expect(card).toBeVisible();
			await page.evaluate(() => document.fonts.ready);
			await page.screenshot({
				path: info.outputPath(`workspace-${width}.png`),
				fullPage: true,
			});
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBe(true);
		}
		const mobile = await browser.newContext({
			storageState: await page.context().storageState(),
			viewport: { width: 390, height: 844 },
			hasTouch: true,
			isMobile: true,
		});
		const phone = await mobile.newPage();
		await phone.goto(`/apps?workspace=${b.id}`);
		await phone.getByRole("button", { name: "Todos", exact: true }).tap();
		await expect(phone).toHaveURL(/\/todos\?/);
		await expect(phone.getByLabel("New task")).toBeVisible();
		await mobile.close();
	} finally {
		execFileSync(
			"pnpm",
			[
				"--filter",
				"server",
				"exec",
				"tsx",
				"tests/access-browser-fixture.ts",
				user.id,
			],
			{ cwd: root, env: process.env, stdio: "pipe" },
		);
	}
});
