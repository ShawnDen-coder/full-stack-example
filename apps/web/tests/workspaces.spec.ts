import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { expect, type Route, test } from "@playwright/test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
test("create workspaces, use cards and keep Todo data scoped when switching", async ({
	page,
	browser,
}, info) => {
	const email = `${randomUUID()}@example.test`;
	const password = "workspace-browser-test-password";
	await page.goto("/sign-up");
	await page.getByLabel("Name", { exact: true }).fill("Workspace tester");
	await page.getByLabel("Email", { exact: true }).fill(email);
	await page.getByLabel("Password", { exact: true }).fill(password);
	await page.getByRole("button", { name: "Sign Up", exact: true }).click();
	await expect(page).toHaveURL(/\/apps(?:\?|$)/);
	const session = await page.evaluate(async () => {
		const response = await fetch(
			"http://127.0.0.1:43100/api/auth/get-session",
			{ credentials: "include" },
		);
		return response.json();
	});
	const user = session.user as { id: string };
	if (!process.env.TEST_DATABASE_URL)
		throw new Error("TEST_DATABASE_URL is required for bootstrap");
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
		const runId = randomUUID().slice(0, 8);
		for (const suffix of ["A", "B"]) {
			const workspaceName = `Workspace ${suffix} ${runId}`;
			await page.goto("/workspaces");
			await page
				.getByRole("button", { name: "New workspace", exact: true })
				.click();
			await page.getByLabel("Name", { exact: true }).fill(workspaceName);
			await page
				.getByLabel("Slug", { exact: true })
				.fill(`browser-${randomUUID()}`);
			await page.getByLabel("Owner email").fill(email);
			if (suffix === "A") {
				await page.route("**/rpc/access/createWorkspace", (route) =>
					route.fulfill({
						status: 503,
						json: { json: { message: "Unavailable" } },
					}),
				);
				await page
					.getByRole("button", { name: "Create workspace", exact: true })
					.click();
				await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
				await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
					workspaceName,
				);
				await page.unroute("**/rpc/access/createWorkspace");
			}
			await page
				.getByRole("button", { name: "Create workspace", exact: true })
				.click();
			await expect(page.getByRole("dialog")).toHaveCount(0);
			await page.getByRole("button", { name: "Switch workspace" }).click();
			await page
				.getByRole("menuitemradio", {
					name: workspaceName,
					exact: true,
				})
				.click();
			await expect(
				page.getByRole("button", { name: "Todos", exact: true }),
			).toBeVisible();
			spaces.push({
				name: workspaceName,
				id: new URL(page.url()).searchParams.get("workspace") ?? "",
			});
		}
		const a = spaces[0];
		const b = spaces[1];
		if (!a || !b) throw new Error("Expected two workspaces");
		await page.goto(`/workspaces?workspace=${a.id}`);
		// A saved legacy list preference must not change the cards-only page.
		await page.evaluate(() => localStorage.setItem("workspaces:view", "list"));
		await page.reload();
		await expect(page.locator("table")).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "List", exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Cards", exact: true }),
		).toHaveCount(0);
		const settings = page.getByRole("button", {
			name: `Settings for ${a.name}`,
			exact: true,
		});
		await settings.click();
		await page.getByLabel("Logo", { exact: true }).setInputFiles({
			name: "logo.png",
			mimeType: "image/png",
			buffer: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAE0lEQVQImWP4z8DwnwGM/zMwAAAf7gP9qS/A4gAAAABJRU5ErkJggg==",
				"base64",
			),
		});
		await expect(page.getByRole("dialog").locator("img")).toBeVisible();
		const renamed = `Renamed workspace ${runId}`;
		await page.getByLabel("Name", { exact: true }).fill(renamed);
		await page.route("**/rpc/access/updateWorkspaceBasics", (route) =>
			route.fulfill({
				status: 503,
				json: { json: { message: "Unavailable" } },
			}),
		);
		await page.getByRole("button", { name: "Save changes" }).click();
		await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
		await expect(page.getByLabel("Name", { exact: true })).toHaveValue(renamed);
		await page.unroute("**/rpc/access/updateWorkspaceBasics");
		await page.getByRole("button", { name: "Save changes" }).click();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect(page.locator("img[src^='data:image/']").first()).toBeVisible();
		await expect(
			page.getByRole("button", { name: `Settings for ${renamed}` }),
		).toBeFocused();
		await page.getByRole("button", { name: `Settings for ${renamed}` }).click();
		await expect(page.getByRole("dialog").locator("img")).toBeVisible();
		await page.getByRole("button", { name: "Remove", exact: true }).click();
		await expect(page.getByRole("dialog").locator("img")).toHaveCount(0);
		// Another editor replaces the server logo while this dialog has a removal draft.
		const blueLogo = await page.evaluate(() => {
			const canvas = document.createElement("canvas");
			canvas.width = 2;
			canvas.height = 2;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas unavailable");
			context.fillStyle = "blue";
			context.fillRect(0, 0, 2, 2);
			return canvas.toDataURL("image/webp");
		});
		expect(
			(
				await page
					.context()
					.request.post(
						"http://127.0.0.1:43100/rpc/access/updateWorkspaceBasics",
						{
							data: {
								json: { workspaceId: a.id, name: renamed, logo: blueLogo },
							},
						},
					)
			).ok(),
		).toBe(true);
		const refreshedLogo = page.waitForResponse(
			(response) =>
				response.url().endsWith("/rpc/access/workspaceLogo") &&
				response.request().postDataJSON().json.workspaceId === a.id,
		);
		await page.evaluate(() =>
			window.dispatchEvent(new Event("visibilitychange")),
		);
		await refreshedLogo;
		await expect(page.getByRole("dialog").locator("img")).toHaveCount(0);
		await page
			.getByRole("button", { name: "Save changes", exact: true })
			.click();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		const removedLogo = await page
			.context()
			.request.post("http://127.0.0.1:43100/rpc/access/workspaceLogo", {
				data: { json: { workspaceId: a.id } },
			});
		expect((await removedLogo.json()).json.logo).toBeNull();
		await page.getByRole("button", { name: `Settings for ${renamed}` }).click();
		await page.getByRole("tab", { name: "Tools" }).click();
		const todosSwitch = page.getByRole("switch", { name: "Enable Todos" });
		await expect(todosSwitch).toBeChecked();
		await page.route("**/rpc/access/setTool", (route) =>
			route.fulfill({
				status: 503,
				json: { json: { message: "Unavailable" } },
			}),
		);
		await todosSwitch.click();
		await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
		await expect(todosSwitch).toBeChecked();
		await page.unroute("**/rpc/access/setTool");
		const getToolState = async () => {
			const response = await page
				.context()
				.request.post("http://127.0.0.1:43100/rpc/access/workspaces", {
					data: { json: { offset: 0 } },
				});
			expect(response.ok()).toBe(true);
			const { items } = (await response.json()).json;
			return items
				.find((space: { id: string }) => space.id === a.id)
				?.tools.find((tool: { key: string }) => tool.key === "todos")?.enabled;
		};
		expect(await getToolState()).toBe(true);
		for (const enabled of [false, true, false, true]) {
			await expect(todosSwitch).toBeEnabled();
			const refreshed = page.waitForResponse(
				(response) =>
					response.url().endsWith("/rpc/access/workspaces") &&
					response.status() === 200,
			);
			await todosSwitch.click();
			await refreshed;
			await expect(todosSwitch).toHaveAttribute(
				"aria-checked",
				String(enabled),
			);
			const access = await page
				.context()
				.request.post("http://127.0.0.1:43100/rpc/access/me", {
					data: { json: { workspaceId: a.id } },
				});
			expect(access.ok()).toBe(true);
			const snapshot = (await access.json()).json;
			expect(snapshot.pages.includes("todos")).toBe(enabled);
			expect(await getToolState()).toBe(enabled);
			const scoped = await page.context().newPage();
			await scoped.goto(`/apps?workspace=${a.id}`);
			await expect(
				scoped.getByRole("link", { name: "Todos", exact: true }),
			).toHaveCount(enabled ? 1 : 0);
			await scoped.goto(`/todos?workspace=${a.id}`);
			if (enabled) await expect(scoped.getByLabel("New task")).toBeVisible();
			else await expect(scoped).toHaveURL(/\/no-access(?:\?|$)/);
			await scoped.close();
		}
		await page.getByRole("button", { name: "Done", exact: true }).click();
		await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
			timeout: 15000,
		});
		for (const width of [1440, 768, 390]) {
			await page.setViewportSize({ width, height: 1000 });
			await page.screenshot({
				path: info.outputPath(`management-cards-${width}.png`),
				fullPage: true,
			});
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBe(true);
		}
		await expect(
			page.getByRole("button", { name: `Settings for ${renamed}` }),
		).toBeVisible();
		await page.getByRole("button", { name: "Toggle theme" }).click();
		await page.getByRole("menuitem", { name: "Dark" }).click();
		await page.screenshot({
			path: info.outputPath("management-cards-390-dark.png"),
			fullPage: true,
		});
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
		await page.getByRole("button", { name: "Toggle theme" }).click();
		await page.getByRole("menuitem", { name: "Light" }).click();
		await page.setViewportSize({ width: 1440, height: 1000 });
		await page.goto(`/apps?workspace=${a.id}`);
		const card = page.getByRole("button", { name: "Todos", exact: true });
		await card.click();
		await expect(page).toHaveURL(/\/apps\?/);
		await card.dblclick();
		await expect(page).toHaveURL(/\/todos\?/);
		await expect(
			page.getByRole("link", { name: "Todos", exact: true }),
		).toHaveAttribute("aria-current", "page");
		await page.getByLabel("New task").fill("Onboarding task");
		await page.getByRole("button", { name: "Add", exact: true }).click();
		await page.getByRole("button", { name: "Edit Onboarding task" }).click();
		await page.getByLabel("Task name").fill("Updated onboarding task");
		await page.getByRole("button", { name: "Save", exact: true }).click();
		await page
			.getByRole("checkbox", { name: "Updated onboarding task" })
			.click();
		await expect(
			page.getByRole("checkbox", { name: "Updated onboarding task" }),
		).toBeChecked();
		await page
			.getByRole("button", { name: "Delete Updated onboarding task" })
			.click();
		await expect(
			page.getByText("Updated onboarding task", { exact: true }),
		).toHaveCount(0);
		await page.getByLabel("New task").fill("Only in workspace A");
		await page.getByRole("button", { name: "Add", exact: true }).click();
		await expect(
			page.getByText("Only in workspace A", { exact: true }),
		).toBeVisible();
		await page.getByRole("button", { name: "Switch workspace" }).click();
		await page
			.getByRole("menuitemradio", { name: b.name, exact: true })
			.click();
		await expect(page).toHaveURL(new RegExp(`workspace=${b.id}`));
		await expect(
			page.getByRole("button", { name: `Switch workspace: ${b.name}` }),
		).toBeVisible();
		const targetTool = page.getByRole("button", { name: "Todos", exact: true });
		await targetTool.focus();
		await expect(targetTool).toBeFocused();
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
		await expect(page).toHaveURL(new RegExp(`workspace=${b.id}`));
		await expect(
			page.getByRole("button", { name: `Switch workspace: ${b.name}` }),
		).toBeVisible();
		await targetTool.focus();
		await expect(targetTool).toBeFocused();
		await page.keyboard.press("Enter");
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
