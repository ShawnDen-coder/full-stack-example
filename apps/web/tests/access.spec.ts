import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";

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
		execFileSync(
			"pnpm",
			[
				"--filter",
				"server",
				"exec",
				"tsx",
				"tests/workspace-browser-fixture.ts",
				data.user.id,
			],
			{ cwd: root, env: process.env, stdio: "pipe" },
		);
		await request.dispose();
		return { id: data.user.id as string, email };
	}
	async function login(target: typeof page, email: string) {
		await target.goto("/sign-in");
		await target.getByLabel("Email", { exact: true }).fill(email);
		await target.getByLabel("Password", { exact: true }).fill(password);
		await target.getByRole("button", { name: "Sign In", exact: true }).click();
		await expect(target).toHaveURL(/\/apps(?:\?|$)/);
	}
	async function findMember(target: Page, email: string) {
		const member = target.getByRole("button", {
			name: `Edit roles for ${email}`,
			exact: true,
		});
		const previous = target.getByRole("button", {
			name: "Previous",
			exact: true,
		});
		const next = target.getByRole("button", { name: "Next", exact: true });
		const firstRow = target.locator("tbody tr").first();
		await expect(firstRow).toBeVisible();
		async function turn(button: typeof next) {
			const before = await firstRow.innerText();
			await button.click();
			await expect
				.poll(async () => {
					const text = await firstRow.innerText().catch(() => "");
					return text !== "" && text !== before;
				})
				.toBe(true);
		}
		while (await previous.isEnabled()) await turn(previous);
		while (!(await member.isVisible())) {
			await expect(next).toBeEnabled();
			await turn(next);
		}
		return member;
	}
	try {
		const owner = await signup("Access owner");
		const person = await signup("Access member");
		const staff = await signup("Access manager");
		execFileSync(
			"pnpm",
			["admin:bootstrap", owner.id, "--workspace-owner", "application"],
			{
				cwd: root,
				env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
				stdio: "pipe",
			},
		);
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
		await (await findMember(page, person.email)).click();
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
		await expect(ordinary).toHaveURL(/\/apps(?:\?|$)/);
		await expect(
			ordinary.getByText("No tools available.", {
				exact: false,
			}),
		).toBeVisible();
		await ordinary.goto("/todos");
		await expect(ordinary).toHaveURL(/\/no-access(?:\?|$)/);
		await expect(
			ordinary.getByRole("link", { name: "Todos", exact: true }),
		).toHaveCount(0);
		const api = await userContext.request.post(
			"http://127.0.0.1:43100/rpc/todo/list",
			{ data: { json: { workspaceId: "application" } } },
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
		await (await findMember(page, staff.email)).click();
		await page
			.getByRole("checkbox", { name: "Administrator", exact: true })
			.check();
		await page
			.getByRole("button", { name: "Save changes", exact: true })
			.click();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await login(manager, staff.email);
		await manager.goto("/admin/users");
		await expect(await findMember(manager, owner.email)).toBeDisabled();
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
