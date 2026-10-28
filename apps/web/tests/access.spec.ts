import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const password = "roles-browser-test-password";
test("administrators configure native page roles through real services", async ({
	page,
	browser,
	playwright,
}, info) => {
	const ids: string[] = [];
	const userContext = await browser.newContext();
	const ordinary = await userContext.newPage();
	const managerContext = await browser.newContext();
	const manager = await managerContext.newPage();
	async function signup(name: string) {
		const request = await playwright.request.newContext();
		const email = `${randomUUID()}@example.test`;
		const response = await request.post(
			"http://127.0.0.1:43100/api/auth/sign-up/email",
			{
				data: { name, email, password },
				headers: { Origin: "http://127.0.0.1:43101" },
			},
		);
		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		ids.push(data.user.id);
		await request.dispose();
		return { id: data.user.id as string, email };
	}
	async function login(target: typeof page, email: string) {
		await target.goto("/sign-in");
		await target.getByLabel("Email", { exact: true }).fill(email);
		await target.getByLabel("Password", { exact: true }).fill(password);
		await target.getByRole("button", { name: "Sign In", exact: true }).click();
		await expect(target).toHaveURL(/\/todos$/);
	}
	try {
		const owner = await signup("Access owner");
		const person = await signup("Access member");
		const staff = await signup("Access manager");
		execFileSync("pnpm", ["admin:bootstrap", owner.id], {
			cwd: root,
			env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
			stdio: "pipe",
		});
		await login(page, owner.email);
		await login(ordinary, person.email);
		await page.goto("/admin/users");

		await page.getByRole("tab", { name: "Page roles" }).click();
		await page
			.getByRole("button", { name: "Create role", exact: true })
			.click();
		await page.getByLabel("Role name", { exact: true }).fill("browser-limited");
		await page
			.getByRole("button", { name: "Save changes", exact: true })
			.click();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await page.getByRole("tab", { name: "Members", exact: true }).click();
		await page
			.getByRole("button", {
				name: `Edit roles for ${person.email}`,
				exact: true,
			})
			.click();
		await page
			.getByRole("checkbox", { name: "standard", exact: true })
			.uncheck();
		await page
			.getByRole("checkbox", { name: "browser-limited", exact: true })
			.check();
		await page
			.getByRole("button", { name: "Save changes", exact: true })
			.click();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await ordinary.reload();
		await expect(ordinary).toHaveURL(/\/no-access$/);
		await expect(
			ordinary.getByRole("link", { name: "Todos", exact: true }),
		).toHaveCount(0);
		const api = await userContext.request.post(
			"http://127.0.0.1:43100/rpc/todo/list",
			{ data: { json: {} } },
		);
		expect(api.status()).toBe(403);

		for (const width of [1440, 768, 390]) {
			await page.setViewportSize({ width, height: 1000 });
			await page.screenshot({
				path: info.outputPath(`access-${width}.png`),
				fullPage: true,
			});
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBeTruthy();
		}
		await page.setViewportSize({ width: 1440, height: 1000 });
		await page
			.getByRole("button", {
				name: `Edit roles for ${staff.email}`,
				exact: true,
			})
			.click();
		await page
			.getByRole("checkbox", { name: "Administrator", exact: true })
			.check();
		await page
			.getByRole("button", { name: "Save changes", exact: true })
			.click();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await login(manager, staff.email);
		await manager.goto("/admin/users");
		await expect(
			manager.getByRole("button", {
				name: `Edit roles for ${owner.email}`,
				exact: true,
			}),
		).toBeDisabled();
		await manager.getByRole("tab", { name: "Page roles" }).click();
		await manager
			.getByRole("button", { name: "Edit browser-limited", exact: true })
			.click();
		await manager
			.getByRole("checkbox", { name: "View Todos", exact: true })
			.check();
		await manager
			.getByRole("button", { name: "Save changes", exact: true })
			.click();
		await expect(manager.getByRole("dialog")).toHaveCount(0);
		await ordinary.goto("/todos");
		await expect(
			ordinary.getByRole("textbox", { name: "New task" }),
		).toBeVisible();
	} finally {
		await userContext.close();
		await managerContext.close();
		if (ids.length)
			execFileSync(
				"pnpm",
				[
					"--filter",
					"server",
					"exec",
					"tsx",
					"tests/access-browser-fixture.ts",
					...ids,
				],
				{ cwd: root, env: process.env, stdio: "pipe" },
			);
	}
});
