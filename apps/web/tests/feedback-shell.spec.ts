import { expect, test } from "@playwright/test";
import { browserJob, mockSession } from "./feedback-fixtures";

test("dashboard shows the upstream overview", async ({ page }) => {
	await mockSession(page);
	await page.route("**/rpc/todo/list**", (route) =>
		route.fulfill({ json: { json: { items: [], nextCursor: null } } }),
	);
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
	await expect(
		page.getByRole("link", { name: "Dashboard example", exact: true }),
	).toHaveAttribute("aria-current", "page");
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

test("ordinary users keep settings but cannot enter administration", async ({
	page,
}) => {
	await mockSession(page);
	await page.goto("/settings/appearance");
	await expect(
		page.getByRole("link", { name: "Users", exact: true }),
	).toHaveCount(0);
	await page.goto("/admin/users");
	await expect(page).toHaveURL(/\/no-access(?:\?|$)/);
	await expect(
		page.getByRole("heading", { name: "Page access required" }),
	).toBeVisible();
	await page.getByRole("link", { name: "Account settings" }).click();
	await expect(page).toHaveURL(/\/settings(?:\?|$)/);
});

test("review: navigation matching has one current entry", async ({ page }) => {
	await mockSession(page);
	await page.route("**/rpc/queues/jobs**", (route) =>
		route.fulfill({
			json: {
				json: {
					mode: "browse",
					items: [],
					total: 0,
					page: 1,
					pageSize: 20,
					refreshedAt: new Date().toISOString(),
				},
			},
		}),
	);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["apps", "queues"],
				},
			},
		}),
	);
	for (const [url, title] of [
		["/apps/integrations-demo", "Integration examples"],
		["/settings/appearance", "Appearance"],
		["/queues/sample/jobs?status=failed", "Queues"],
	]) {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(url);
		const sidebar = page.locator('[data-sidebar="content"]');
		await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
		await expect(
			sidebar.getByRole("link", { name: title, exact: true }),
		).toHaveAttribute("aria-current", "page");
		await expect(sidebar.locator('[data-active="true"]')).toHaveCount(1);
		await page.locator('[data-sidebar="trigger"]').click();
		await expect(sidebar.locator('[data-active="true"]')).toHaveCount(1);
	}
	await page.setViewportSize({ width: 390, height: 900 });
	await page.goto("/settings/appearance");
	await page.locator('[data-sidebar="trigger"]').click();
	const mobile = page.locator('[data-sidebar="content"]:visible');
	await expect(mobile.locator('[aria-current="page"]')).toHaveCount(1);
	await expect(
		mobile.getByRole("link", { name: "Appearance", exact: true }),
	).toHaveAttribute("aria-current", "page");
});

test("review: logs-only denial is visible and retry recovers", async ({
	page,
}) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["queues"],
				},
			},
		}),
	);
	let code = 404;
	await page.route("**/rpc/queues/job**", (route) =>
		route.fulfill({
			json: {
				json: {
					...browserJob,
					result: {},
					stacktrace: null,
					refreshedAt: new Date().toISOString(),
				},
			},
		}),
	);
	await page.route("**/rpc/queues/logs**", (route) =>
		code
			? route.fulfill({
					status: code,
					json: {
						json: {
							defined: false,
							code: code === 403 ? "FORBIDDEN" : "NOT_FOUND",
							status: code,
							message: "Denied",
						},
					},
				})
			: route.fulfill({
					json: {
						json: {
							lines: ["Recovered log"],
							total: 1,
							page: 1,
							pageSize: 50,
							clipped: false,
						},
					},
				}),
	);
	for (const failure of [404, 403]) {
		code = failure;
		await page.goto(`/queues/sample/jobs/id-${failure}`);
		await expect(page.getByRole("alert")).toContainText(
			failure === 404 ? "Not found" : "Access denied",
		);
		await expect(page.getByText("Worker could not read profile")).toHaveCount(
			0,
		);
		code = 0;
		await page.getByRole("button", { name: "Retry", exact: true }).click();
		await expect(page.getByText("Recovered log")).toBeVisible();
	}
});

test("review: ID and name searches do not automatically rescan", async ({
	page,
}) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["queues"],
				},
			},
		}),
	);
	let calls = 0;
	await page.route("**/rpc/queues/jobs**", (route) => {
		calls++;
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
	for (const mode of ["name", "id"]) {
		await page.goto(`/queues/sample/jobs?mode=${mode}`);
		const input = page.getByRole("textbox", {
			name: mode === "id" ? "Exact job ID" : "Full job name",
		});
		const before = calls;
		await input.fill("query");
		await page.waitForTimeout(500);
		expect(calls).toBe(before);
		await page.getByRole("button", { name: "Search", exact: true }).click();
		await expect.poll(() => calls).toBe(before + 1);
		await page.waitForTimeout(5500);
		await page.evaluate(() => {
			window.dispatchEvent(new Event("focus"));
			window.dispatchEvent(new Event("online"));
		});
		await page.waitForTimeout(500);
		expect(calls).toBe(before + 1);
	}
});

test("review: zero permission account screenshots", async ({ page }, info) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: { role: "user", organizationId: "application", pages: [] },
			},
		}),
	);
	for (const theme of ["light", "dark"]) {
		await page.goto("/apps");
		await page.evaluate(
			(value) => localStorage.setItem("vite-ui-theme", value),
			theme,
		);
		for (const width of [1440, 768, 390]) {
			await page.setViewportSize({ width, height: 900 });
			await page.goto("/apps");
			await expect(
				page.getByText("No tools available.", {
					exact: false,
				}),
			).toBeVisible();
			await expect(
				page
					.getByRole("main")
					.getByRole("button", { name: "Todos", exact: true }),
			).toHaveCount(0);
			await page.screenshot({
				path: info.outputPath(`zero-${theme}-${width}.png`),
				fullPage: true,
			});
		}
	}
});

test("polish: tool center permission layouts and reduced motion", async ({
	page,
}, info) => {
	test.setTimeout(90000); // 18 navigations and full-page screenshots across the permission matrix.
	await mockSession(page);
	let grants: string[] = [];
	let role = "user";
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: { json: { role, organizationId: "application", pages: grants } },
		}),
	);
	for (const [kind, pages, roleValue] of [
		["zero", [], "user"],
		["one", ["todos"], "user"],
		["admin", [], "admin"],
	] as Array<[string, string[], string]>) {
		grants = pages;
		role = roleValue;
		for (const theme of ["light", "dark"]) {
			await page.goto("/apps");
			await page.evaluate(
				(value) => localStorage.setItem("vite-ui-theme", value),
				theme,
			);
			for (const width of [1440, 768, 390]) {
				await page.setViewportSize({ width, height: 900 });
				await page.goto("/apps");
				await expect(
					page.getByRole("heading", { name: "Tool home" }),
				).toBeVisible();
				await page.screenshot({
					path: info.outputPath(`${kind}-${theme}-${width}.png`),
					fullPage: true,
				});
				expect(
					await page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth,
					),
				).toBeTruthy();
			}
		}
	}
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/apps");
	await page.locator('[data-sidebar="trigger"]').click();
	await page.screenshot({
		path: info.outputPath("sidebar-collapsed.png"),
		fullPage: true,
	});
	await page.evaluate(() => {
		document.body.style.zoom = "2";
	});
	await page.screenshot({
		path: info.outputPath("zoom-200.png"),
		fullPage: true,
	});
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBeTruthy();
	await page.emulateMedia({ reducedMotion: "reduce" });
	grants = ["todos"];
	await page.goto("/apps?workspace=application");
	await expect(
		page.getByRole("button", { name: "Todos", exact: true }),
	).toBeVisible();
	const duration = await page
		.locator("main [data-slot=card]")
		.first()
		.evaluate((element) => getComputedStyle(element).transitionDuration);
	expect(
		duration.split(",").every((value) => Number.parseFloat(value) === 0),
	).toBeTruthy();
});

test("polish: readable muted text and validation in both themes", async ({
	page,
}) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["queues"],
				},
			},
		}),
	);
	for (const theme of ["light", "dark"]) {
		await page.goto("/apps");
		await page.evaluate(
			(value) => localStorage.setItem("vite-ui-theme", value),
			theme,
		);
		await page.reload();
		const paragraph = page.getByText(
			"No tools available. Contact your workspace administrator.",
		);
		await expect(paragraph).toBeVisible();
		const ratio = await paragraph.evaluate((element) => {
			const canvas = document.createElement("canvas");
			canvas.width = 2;
			canvas.height = 1;
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("Canvas unavailable");
			ctx.fillStyle = getComputedStyle(element).color;
			ctx.fillRect(0, 0, 1, 1);
			ctx.fillStyle = getComputedStyle(document.documentElement)
				.getPropertyValue("--background")
				.trim();
			ctx.fillRect(1, 0, 1, 1);
			const pixels = ctx.getImageData(0, 0, 2, 1).data;
			const lum = (offset: number) =>
				[0, 1, 2].reduce((sum, index) => {
					const value = (pixels[offset + index] ?? 0) / 255;
					return (
						sum +
						([0.2126, 0.7152, 0.0722][index] ?? 0) *
							(value <= 0.04045
								? value / 12.92
								: ((value + 0.055) / 1.055) ** 2.4)
					);
				}, 0);
			const a = lum(0);
			const b = lum(4);
			return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
		});
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	}
	await page.goto("/queues/sample/jobs?mode=name");
	const field = page.getByRole("textbox", { name: "Full job name" });
	await field.fill("   ");
	await expect(field).toHaveAttribute("aria-invalid", "true");
	await expect(field).toHaveAccessibleDescription(/Enter a non-empty search/);
});

test("polish: keyboard groups, history, IME and announcements", async ({
	page,
}) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["queues"],
				},
			},
		}),
	);
	let calls = 0;
	await page.route("**/rpc/queues/jobs**", (route) => {
		calls++;
		return route.fulfill({
			json: {
				json: {
					mode: "browse",
					items: [],
					total: 0,
					page: 1,
					pageSize: 20,
					refreshedAt: new Date().toISOString(),
				},
			},
		});
	});
	await page.goto("/queues/sample/jobs");
	await expect.poll(() => calls).toBe(1);
	const waiting = page.getByRole("radio", { name: "Waiting", exact: true });
	const active = page.getByRole("radio", { name: "Active", exact: true });
	await waiting.focus();
	await page.keyboard.press("ArrowRight");
	await expect(active).toBeFocused();
	await expect(waiting).toHaveAttribute("aria-checked", "true");
	expect(calls).toBe(1);
	await page.keyboard.press("Space");
	await expect(page).toHaveURL(/status=active/);
	await expect(active).toHaveAttribute("aria-checked", "true");
	await page.goBack();
	await expect(waiting).toHaveAttribute("aria-checked", "true");
	await page.getByRole("button", { name: "Find job" }).click();
	await page.getByRole("radio", { name: "Full job name" }).click();
	const input = page.getByRole("textbox", { name: "Full job name" });
	await input.fill("hello");
	const prevented = await input.evaluate((element) =>
		[
			new KeyboardEvent("keydown", {
				key: "Enter",
				repeat: true,
				bubbles: true,
				cancelable: true,
			}),
			new KeyboardEvent("keydown", {
				key: "Enter",
				isComposing: true,
				bubbles: true,
				cancelable: true,
			}),
		].map((event) => {
			element.dispatchEvent(event);
			return event.defaultPrevented;
		}),
	);
	expect(prevented).toEqual([true, true]);
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect(
		page.getByRole("main").locator('[aria-live="polite"]'),
	).toContainText("Search for hello completed.");
});

test("polish: retry and repeated submits share the synchronous lock", async ({
	page,
}) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["queues"],
				},
			},
		}),
	);
	let calls = 0;
	let recovering = false;
	let release = () => {};
	await page.route("**/rpc/queues/jobs**", async (route) => {
		calls++;
		if (!recovering)
			return route.fulfill({
				status: 503,
				json: {
					json: {
						defined: false,
						code: "SERVICE_UNAVAILABLE",
						status: 503,
						message: "Unavailable",
					},
				},
			});
		await new Promise<void>((resolve) => {
			release = resolve;
		});
		await route.fulfill({
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
	await page.goto("/queues/sample/jobs?mode=name");
	const input = page.getByRole("textbox", { name: "Full job name" });
	await input.fill("A");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Retry", exact: true }),
	).toBeVisible({ timeout: 15000 });
	recovering = true;
	const initial = calls;
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect.poll(() => calls).toBe(initial + 1);
	await expect(
		page.getByRole("button", { name: "Retry", exact: true }),
	).toBeDisabled();
	await input.press("Enter");
	await input.press("Enter");
	expect(calls).toBe(initial + 1);
	release();
	await expect(page.getByRole("alert")).toHaveCount(0);
	await expect(input).toBeFocused();
});

test("round1: search has a persistent accessible name and restores focus", async ({
	page,
}) => {
	await mockSession(page);
	await page.goto("/apps");
	const trigger = page.getByRole("button", { name: "Search pages" });
	await trigger.click();
	const search = page.getByRole("combobox", { name: "Search pages" });
	await search.fill("Todos");
	await expect(search).toHaveAccessibleName("Search pages");
	await search.press("Escape");
	await expect(trigger).toBeFocused();
});

test("round1: mobile settings follows history and invalid profile focuses name", async ({
	page,
}) => {
	await mockSession(page);
	await page.setViewportSize({ width: 390, height: 600 });
	await page.goto("/settings");
	const name = page.getByLabel("Name", { exact: true });
	let updates = 0;
	await page.route("**/api/auth/update-user", (route) => {
		updates++;
		return route.fulfill({ json: {} });
	});
	for (const value of ["   ", "x".repeat(101)]) {
		await name.fill(value);
		await page.getByRole("button", { name: "Update profile" }).focus();
		await page.keyboard.press("Enter");
		await expect(name).toBeFocused();
		await expect(name).toHaveAttribute("aria-invalid", "true");
	}
	expect(updates).toBe(0);
	const select = page.getByRole("combobox");
	await select.click();
	await page.getByRole("option", { name: "Appearance" }).click();
	await expect(page).toHaveURL(/appearance/);
	await page.goBack();
	await expect(select).toContainText("Profile");
	await page.goForward();
	await expect(select).toContainText("Appearance");
	await page.goBack();
	await select.click();
	await page.getByRole("option", { name: "Appearance" }).click();
	await expect(page).toHaveURL(/appearance/);
});

test("round1 candidate C: shrinking log totals recover the current page", async ({
	page,
}) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["queues"],
				},
			},
		}),
	);
	await page.route("**/rpc/queues/job**", (route) =>
		route.fulfill({
			json: {
				json: {
					...browserJob,
					result: {},
					stacktrace: null,
					refreshedAt: new Date().toISOString(),
				},
			},
		}),
	);
	let total = 80;
	await page.route("**/rpc/queues/logs**", (route) => {
		const request = route.request().postDataJSON();
		const current = request.json.page as number;
		return route.fulfill({
			json: {
				json: {
					lines:
						current === 1
							? ["First log"]
							: total > 50
								? ["Second page log"]
								: [],
					total,
					page: current,
					pageSize: 50,
					clipped: false,
				},
			},
		});
	});
	await page.goto("/queues/sample/jobs/job");
	await page.getByRole("button", { name: "Next logs" }).click();
	await expect(page.getByText("Second page log")).toBeVisible();
	total = 30;
	await expect(page.getByText("First log")).toBeVisible({ timeout: 12000 });
});

test("round1: explicit search retries once and cached results survive history", async ({
	page,
}) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["queues"],
				},
			},
		}),
	);
	let calls = 0;
	let failure = false;
	await page.route("**/rpc/queues/jobs**", (route) => {
		calls++;
		return failure
			? route.fulfill({
					status: 503,
					json: {
						json: {
							defined: false,
							code: "SERVICE_UNAVAILABLE",
							status: 503,
							message: "Unavailable",
						},
					},
				})
			: route.fulfill({
					json: {
						json: {
							mode: "name",
							items: [browserJob],
							scannedCount: 1,
							scanTruncated: false,
							resultsTruncated: false,
							refreshedAt: new Date().toISOString(),
						},
					},
				});
	});
	await page.route("**/rpc/queues/job", (route) =>
		route.fulfill({
			json: {
				json: {
					...browserJob,
					result: {},
					stacktrace: null,
					refreshedAt: new Date().toISOString(),
				},
			},
		}),
	);
	await page.route("**/rpc/queues/logs**", (route) =>
		route.fulfill({
			json: {
				json: { lines: [], total: 0, page: 1, pageSize: 50, clipped: false },
			},
		}),
	);
	await page.goto("/queues/sample/jobs?mode=name&query=first");
	await expect(page.getByTitle(browserJob.id)).toBeVisible();
	expect(calls).toBe(1);
	await page.getByTitle(browserJob.id).click();
	await page.goBack();
	await expect(page.getByTitle(browserJob.id)).toBeVisible();
	await page.waitForTimeout(500);
	expect(calls).toBe(1);
	failure = true;
	await page.getByRole("textbox", { name: "Full job name" }).fill("second");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect(page.getByRole("alert")).toBeVisible();
	await page.waitForTimeout(3500);
	expect(calls).toBe(2);
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect.poll(() => calls).toBe(3);
	await expect(
		page.getByRole("button", { name: "Retry", exact: true }),
	).toBeEnabled();
	await page.goBack();
	await expect(page.getByTitle(browserJob.id)).toBeVisible();
	await page.goForward();
	await expect(page.getByRole("alert")).toBeVisible();
	await page.waitForTimeout(500);
	expect(calls).toBe(3);
	failure = false;
	await page.getByRole("textbox", { name: "Full job name" }).fill("first");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect.poll(() => calls).toBe(4);
	failure = true;
	await page.getByRole("textbox", { name: "Full job name" }).fill("second");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect.poll(() => calls).toBe(5);
	await expect(
		page.getByRole("button", { name: "Retry", exact: true }),
	).toBeEnabled();
	await page.evaluate(async () => {
		const load = new Function('return import("/src/utils/orpc.ts")');
		const { queryClient } = await load();
		await queryClient.invalidateQueries();
	});
	await expect.poll(() => calls).toBe(6);
});

test("round1: focus indicators contrast against their surfaces", async ({
	page,
}) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["todos", "apps", "queues"],
				},
			},
		}),
	);
	await page.setViewportSize({ width: 390, height: 700 });
	await page.addInitScript(() =>
		localStorage.setItem("vite-ui-theme", "light"),
	);
	await page.goto("/queues/sample/jobs?mode=name");
	for (const label of ["Exact job ID", "Full job name"]) {
		const button = page.getByRole("radio", { name: label });
		await button.focus();
		const ratio = await button.evaluate((element) => {
			const paint = (color: string) => {
				const canvas = document.createElement("canvas");
				canvas.width = canvas.height = 1;
				const c = canvas.getContext("2d");
				if (!c) throw new Error("Canvas context unavailable");
				c.fillStyle = "white";
				c.fillRect(0, 0, 1, 1);
				c.fillStyle = color;
				c.fillRect(0, 0, 1, 1);
				return Array.from(c.getImageData(0, 0, 1, 1).data).slice(0, 3);
			};
			const luminance = (color: number[]) =>
				color
					.map((v) => {
						const c = v / 255;
						return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
					})
					.reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
			const style = getComputedStyle(element);
			const ink = luminance(paint(style.getPropertyValue("--foreground")));
			const background = luminance(paint(style.backgroundColor));
			return (
				(Math.max(ink, background) + 0.05) / (Math.min(ink, background) + 0.05)
			);
		});
		expect(ratio).toBeGreaterThanOrEqual(3);
	}
	await page.screenshot({
		path: "/tmp/app-platform-delivery/round1-queue-focus.png",
	});
	await page.goto("/apps");
	const toolLink = page
		.getByRole("main")
		.getByRole("button", { name: "Todos", exact: true });
	await toolLink.focus();
	await page.keyboard.press("Tab");
	await page.keyboard.press("Shift+Tab");
	await expect(toolLink).toBeFocused();
	await page.waitForTimeout(250);
	await expect(toolLink).toHaveCSS("outline-style", "solid");
	const outline = await toolLink.evaluate((el) => {
		const style = getComputedStyle(el);
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 1;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Canvas context unavailable");
		context.fillStyle = "white";
		context.fillRect(0, 0, 1, 1);
		context.fillStyle = style.outlineColor;
		context.fillRect(0, 0, 1, 1);
		const rgb = context.getImageData(0, 0, 1, 1).data;
		const luminance = [0, 1, 2].reduce((sum, i) => {
			const c = rgb[i] / 255;
			return (
				sum +
				(c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) *
					[0.2126, 0.7152, 0.0722][i]
			);
		}, 0);
		return {
			ratio: 1.05 / (luminance + 0.05),
			width: style.outlineWidth,
			visible: el.matches(":focus-visible"),
		};
	});
	expect(outline.visible).toBe(true);
	expect(outline.width).toBe("2px");
	expect(outline.ratio).toBeGreaterThanOrEqual(3);
	await page.screenshot({
		path: "/tmp/app-platform-delivery/round1-tool-focus.png",
	});
});

test("round2: denied target never searches cached term after redirect", async ({
	page,
}) => {
	await mockSession(page);
	let allowed = true;
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: allowed ? "superadmin" : "user",
					pages: allowed ? ["queues", "apps"] : ["apps"],
				},
			},
		}),
	);
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
	await expect(
		page.getByRole("button", { name: "Search", exact: true }),
	).toBeEnabled();
	await expect.poll(() => terms.length).toBe(2);
	allowed = false;
	await page.getByRole("textbox", { name: "Full job name" }).fill("B");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect(page).toHaveURL(/no-access/);
	await page.waitForTimeout(300);
	expect(terms).toEqual(["B", "A"]);
});

test("workspace shell defaults to light and keeps desktop sidebar preference", async ({
	page,
}) => {
	await mockSession(page);
	await page.setViewportSize({ width: 768, height: 600 });
	await page.goto("/apps");
	await expect(page.locator("html")).toHaveClass(/light/);
	const toggle = page
		.getByRole("banner")
		.getByRole("button", { name: "Toggle Sidebar" });
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await page.setViewportSize({ width: 767, height: 600 });
	await page.setViewportSize({ width: 768, height: 600 });
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await page.reload();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await page.evaluate(() => localStorage.setItem("vite-ui-theme", "dark"));
	await page.reload();
	await expect(page.locator("html")).toHaveClass(/dark/);
});

test("mobile breadcrumbs and search preserve focus and workspace", async ({
	page,
}) => {
	await mockSession(page);
	await page.route("**/rpc/todo/list**", (route) =>
		route.fulfill({ json: { json: { items: [], nextCursor: null } } }),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/todos?workspace=application");
	const header = page.getByRole("banner");
	const toggle = header.getByRole("button", { name: "Toggle Sidebar" });
	await expect(toggle).toBeVisible();
	const bounds = await toggle.boundingBox();
	expect(bounds?.x).toBe(8);
	expect(bounds?.width).toBe(44);
	const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
	await expect(
		breadcrumb.getByRole("link", { name: "Tool home" }),
	).toBeVisible();
	await expect(breadcrumb.getByText("Todos")).toBeVisible();
	const trigger = page.getByRole("button", { name: "Search pages" });
	await trigger.click();
	await page.getByRole("combobox", { name: "Search pages" }).press("Escape");
	await expect(trigger).toBeFocused();
	await trigger.click();
	await page.getByRole("combobox", { name: "Search pages" }).fill("Tool home");
	await page.getByRole("option", { name: "Tool home" }).click();
	await expect(page).toHaveURL(/\/apps\?workspace=application/);
	await expect(page.getByRole("main")).toBeFocused();
});

test("search preserves its query when route preparation fails", async ({
	page,
}) => {
	await mockSession(page);
	let fail = false;
	await page.route("**/rpc/access/me", (route) =>
		fail
			? route.abort("failed")
			: route.fulfill({
					json: {
						json: {
							role: "user",
							organizationId: "application",
							pages: ["todos", "apps"],
						},
					},
				}),
	);
	await page.route("**/rpc/todo/list**", (route) =>
		route.fulfill({ json: { json: { items: [], nextCursor: null } } }),
	);
	await page.goto("/apps?workspace=application");
	await page.getByRole("button", { name: "Search pages" }).click();
	const query = page.getByRole("combobox", { name: "Search pages" });
	await query.fill("Todos");
	fail = true;
	await page.getByRole("option", { name: "Todos", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText(
		"Unable to open that page",
	);
	await expect(query).toHaveValue("Todos");
	await expect(page).toHaveURL(/\/apps\?workspace=application/);
	fail = false;
	await page.getByRole("option", { name: "Todos", exact: true }).click();
	await expect(page).toHaveURL(/\/todos\?workspace=application/);
	await expect(page.getByRole("main")).toBeFocused();
});

test("cancelled search does not navigate when delayed preparation completes", async ({
	page,
}) => {
	await mockSession(page);
	let delay = false;
	let release = () => {};
	let seen = () => {};
	const requested = new Promise<void>((resolve) => {
		seen = resolve;
	});
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/rpc/access/me", async (route) => {
		if (delay) {
			seen();
			await held;
		}
		await route
			.fulfill({
				json: {
					json: {
						role: "user",
						organizationId: "application",
						pages: ["todos", "apps"],
					},
				},
			})
			.catch(() => {});
	});
	await page.goto("/apps?workspace=application");
	const trigger = page.getByRole("button", { name: "Search pages" });
	await trigger.click();
	await page.getByRole("combobox", { name: "Search pages" }).fill("Todos");
	delay = true;
	await page.getByRole("option", { name: "Todos", exact: true }).click();
	await requested;
	await page.keyboard.press("Escape");
	await expect(trigger).toBeFocused();
	release();
	await page.waitForTimeout(500);
	await expect(page).toHaveURL(/\/apps\?workspace=application/);
	await expect(trigger).toBeFocused();
});

test("search opens index routes and focuses main while preserving workspace", async ({
	page,
}) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["todos", "queues", "apps"],
				},
			},
		}),
	);
	await page.route("**/rpc/queues/list**", (route) =>
		route.fulfill({ json: { json: [] } }),
	);
	for (const [name, path] of [
		["Profile", "/settings"],
		["Queues", "/queues"],
	] as const) {
		await page.goto("/apps?workspace=application");
		await page.getByRole("button", { name: "Search pages" }).click();
		await page.getByRole("combobox", { name: "Search pages" }).fill(name);
		await page.getByRole("option", { name, exact: true }).click();
		await expect
			.poll(() => new URL(page.url()).pathname.replace(/\/$/, ""))
			.toBe(path);
		await expect
			.poll(() => new URL(page.url()).searchParams.get("workspace"))
			.toBe("application");
		await expect(page.getByRole("main")).toBeFocused();
	}
});

test("header tools and collapsed workspace switcher match approved geometry", async ({
	page,
}, info) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["todos", "queues", "apps"],
				},
			},
		}),
	);
	await page.route("**/rpc/queues/job**", (route) =>
		route.fulfill({
			json: {
				json: {
					...browserJob,
					result: {},
					stacktrace: null,
					refreshedAt: new Date().toISOString(),
				},
			},
		}),
	);
	await page.route("**/rpc/queues/logs**", (route) =>
		route.fulfill({
			json: {
				json: { lines: [], total: 0, page: 1, pageSize: 50, clipped: false },
			},
		}),
	);
	for (const width of [390, 320, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto(
			"/queues/sample/jobs/long-layout-test-name?workspace=application",
		);
		const search = page.getByRole("button", { name: "Search pages" });
		await expect(search).toBeVisible();
		const tools = [
			search,
			page.getByRole("button", { name: "Toggle theme" }),
			page.getByRole("button", { name: "Open theme settings" }),
		];
		const boxes = await Promise.all(tools.map((tool) => tool.boundingBox()));
		if (boxes.some((box) => !box)) throw new Error("Missing tool geometry");
		const [first, second, third] = boxes;
		if (!first || !second || !third) throw new Error("Missing tool geometry");
		for (const box of [first, second, third]) expect(box.width).toBe(44);
		expect(first.x + first.width).toBeLessThanOrEqual(second.x);
		expect(second.x + second.width).toBeLessThanOrEqual(third.x);
		expect(third.x + third.width).toBe(width - (width >= 768 ? 37 : 28));
		if (width === 390) expect(first.x + first.width / 2).toBe(252);
		const breadcrumb = await page
			.getByRole("navigation", { name: "Breadcrumb" })
			.boundingBox();
		if (!breadcrumb) throw new Error("Missing breadcrumb geometry");
		expect(breadcrumb.x + breadcrumb.width).toBeLessThanOrEqual(first.x);
		await page.screenshot({ path: info.outputPath(`header-${width}.png`) });
	}
	await page.setViewportSize({ width: 768, height: 900 });
	await page.goto("/apps?workspace=application");
	await page.locator('[data-slot="sidebar-trigger"]').click();
	const gap = page.locator('[data-slot="sidebar-gap"]');
	const container = page.locator('[data-slot="sidebar-container"]');
	const inset = page.locator('[data-slot="sidebar-inset"]');
	const switcher = page.getByRole("button", { name: /Switch workspace/ });
	await expect.poll(async () => (await gap.boundingBox())?.width).toBe(64);
	await expect
		.poll(async () => (await switcher.boundingBox())?.height)
		.toBe(48);
	const logo = await switcher.locator("div").first().boundingBox();
	const fixed = await container.boundingBox();
	const surface = await inset.boundingBox();
	if (!logo || !fixed || !surface) throw new Error("Missing sidebar geometry");
	expect(fixed.width).toBe(66);
	expect(logo.x + logo.width / 2).toBe(32);
	expect(logo.y).toBe(24);
	expect(logo.y + logo.height).toBe(56);
	expect(surface.x).toBe(72);
	await page.screenshot({ path: info.outputPath("sidebar-768-collapsed.png") });
});
