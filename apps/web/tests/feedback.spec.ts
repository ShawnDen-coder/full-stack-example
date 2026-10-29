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
					organizationId: "application",
					pages: ["todos", "dashboard", "tasks", "apps", "chats"],
				},
			},
		}),
	);
	await page.route("**/rpc/access/mine", (route) =>
		route.fulfill({
			json: {
				json: [{ id: "application", name: "Application", slug: "application" }],
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
	await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
	await expect(
		page.getByRole("link", { name: "Dashboard example", exact: true }),
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

test("queue queries isolate ranges, retain same-query 503 data and clear on 403", async ({
	page,
}, info) => {
	await mockSession(page);
	let accessCalls = 0;
	await page.route("**/rpc/access/me", (route) => {
		accessCalls++;
		return route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["queues"],
				},
			},
		});
	});
	let result: "ok" | "unavailable" | "forbidden" = "ok";
	let requests = 0;
	await page.route("**/rpc/queues/jobs**", (route) => {
		requests++;
		if (result !== "ok") {
			const status = result === "forbidden" ? 403 : 503;
			return route.fulfill({
				status,
				json: {
					json: {
						defined: false,
						code: result === "forbidden" ? "FORBIDDEN" : "SERVICE_UNAVAILABLE",
						status,
						message: "Unavailable",
					},
				},
			});
		}
		return route.fulfill({
			json: {
				json: {
					mode: "name",
					items: [
						{
							id: "a",
							name: "private job",
							state: "failed",
							attemptsMade: 1,
							attemptsConfigured: 2,
							timestamp: 1,
							processedOn: null,
							finishedOn: null,
							failedReason: "Search failure summary",
							summary: {},
						},
					],
					scannedCount: 2,
					scanTruncated: false,
					resultsTruncated: false,
					refreshedAt: new Date().toISOString(),
				},
			},
		});
	});
	await page.goto("/queues/sample/jobs?mode=name");
	await expect(
		page.getByRole("textbox", { name: "Full job name" }),
	).toBeVisible();
	expect(requests).toBe(0);
	await page
		.getByRole("textbox", { name: "Full job name" })
		.fill("private job");
	await page.waitForTimeout(500);
	expect(requests).toBe(0);
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect(page.getByRole("link", { name: "private job" })).toBeVisible();
	await expect(page.getByText("Search failure summary")).toBeVisible();
	result = "unavailable";
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText(
		"last successful request",
		{ timeout: 15000 },
	);
	await expect(page.getByRole("link", { name: "private job" })).toBeVisible();
	await page.getByRole("textbox", { name: "Full job name" }).fill("another");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect(page).toHaveURL(/query=another/);
	await expect(page.getByRole("alert")).toContainText(
		"Queue data is unavailable",
		{ timeout: 15000 },
	);
	await expect(
		page.getByRole("button", { name: "Retry", exact: true }),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "private job" })).toHaveCount(0);
	await page.screenshot({
		path: info.outputPath("queue-search-error.png"),
		fullPage: true,
	});
	result = "ok";
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(page.getByRole("link", { name: "private job" })).toBeVisible();
	const before = accessCalls;
	result = "forbidden";
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.getByRole("link", { name: "private job" })).toHaveCount(0);
	await expect.poll(() => accessCalls).toBeGreaterThan(before);
});

test("scheduler pages do not show another range after failure and reset on queue change", async ({
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
	let fail = false;
	await page.route("**/rpc/queues/schedulers**", (route) => {
		if (fail)
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
		return route.fulfill({
			json: {
				json: {
					items: [
						{
							id: "schedule-a",
							name: "First scheduler",
							pattern: "* * * * *",
							every: null,
							tz: null,
							next: null,
							lastTrigger: { kind: "unknown" },
						},
					],
					total: 100,
					page: 1,
					refreshedAt: new Date().toISOString(),
				},
			},
		});
	});
	await page.goto("/queues/first/schedulers");
	await expect(page.getByText("First scheduler")).toBeVisible();
	fail = true;
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(page.getByRole("alert")).toBeVisible({ timeout: 15000 });
	await expect(page.getByText("First scheduler")).toHaveCount(0);
	fail = false;
	await page.goto("/queues/second/schedulers");
	await expect(page.getByText("First scheduler")).toBeVisible();
	await expect(page.getByText(/Page 1 of 2/)).toBeVisible();
});

const browserJob = {
	id: "job-123456789012345678901234",
	name: "profile",
	state: "failed",
	attemptsMade: 2,
	attemptsConfigured: 3,
	timestamp: 1700000000000,
	processedOn: null,
	finishedOn: 1700000001000,
	failedReason: "Worker could not read profile",
	summary: { userId: "user-123" },
};

test("review: mobile job fields, failure summaries, page limit and evidence", async ({
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
	let requests = 0;
	await page.route("**/rpc/queues/jobs**", (route) => {
		requests++;
		return route.fulfill({
			json: {
				json: {
					mode: "browse",
					items: [browserJob],
					total: 200001,
					page: 10000,
					pageSize: 20,
					refreshedAt: new Date().toISOString(),
				},
			},
		});
	});
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
				page
					.getByRole("main")
					.getByRole("button", { name: "Todos", exact: true }),
			).toBeVisible();
			await expect(
				page.getByRole("main").getByRole("button", { name: "Queues" }),
			).toHaveCount(0);
			await page.screenshot({
				path: info.outputPath(`tools-${theme}-${width}.png`),
				fullPage: true,
			});
			await page.goto("/queues/sample/jobs?status=failed&page=10000");
			await expect(
				page.getByText("Worker could not read profile"),
			).toBeVisible();
			for (const label of [
				"User ID",
				"Attempts",
				"Created",
				"Finished",
				"Failure",
			])
				await expect(
					page.locator("td").getByText(label, { exact: true }),
				).toBeAttached();
			if (width <= 768)
				for (const label of [
					"User ID",
					"Attempts",
					"Created",
					"Finished",
					"Failure",
				])
					await expect(
						page.locator("td").getByText(label, { exact: true }),
					).toBeVisible();
			await expect(page.getByTitle(browserJob.id)).toBeVisible();
			await expect(
				page.getByRole("button", { name: "Next", exact: true }),
			).toBeDisabled();
			await expect(
				page.getByText(/Browsing limited to 10,000 pages/),
			).toBeVisible();
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBeTruthy();
			await page.screenshot({
				path: info.outputPath(`jobs-${theme}-${width}.png`),
				fullPage: true,
			});
		}
	}
	const before = requests;
	await page
		.getByRole("button", { name: "Next", exact: true })
		.click({ force: true })
		.catch(() => {});
	expect(requests).toBe(before);
	await page.goto("/queues/sample/jobs?page=10001");
	await expect(page.getByText(/Page 1 of/)).toBeVisible();
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

test("review: delayed previous queue and search responses never appear in a new scope", async ({
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
	let release = () => {};
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	let captured = () => {};
	const capture = new Promise<void>((resolve) => {
		captured = resolve;
	});
	let first = true;
	await page.route("**/rpc/queues/jobs**", async (route) => {
		if (first) {
			first = false;
			captured();
			await held;
		}
		await route
			.fulfill({
				json: {
					json: {
						mode: "browse",
						items: [browserJob],
						total: 1,
						page: 1,
						pageSize: 20,
						refreshedAt: new Date().toISOString(),
					},
				},
			})
			.catch(() => {});
	});
	await page.goto("/queues/first/jobs");
	await capture;
	await page.goto("/queues/second/jobs?mode=name");
	await expect(
		page.getByRole("textbox", { name: "Full job name" }),
	).toBeVisible();
	release();
	await page.waitForTimeout(300);
	await expect(page.getByText("Worker could not read profile")).toHaveCount(0);
});

test("polish: controlled toggles and search lock keep the draft and scope", async ({
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
	let release = () => {};
	let waiting = false;
	await page.route("**/rpc/queues/jobs**", async (route) => {
		calls++;
		if (waiting)
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
	await page.goto("/queues/sample/jobs?mode=name");
	const name = page.getByRole("radio", { name: "Full job name" });
	const field = page.getByRole("textbox", { name: "Full job name" });
	await field.fill("A");
	await name.click();
	await expect(field).toHaveValue("A");
	expect(calls).toBe(0);
	await name.focus();
	await page.keyboard.press("ArrowLeft");
	await expect(page.getByRole("radio", { name: "Exact job ID" })).toBeFocused();
	await expect(field).toHaveValue("A");
	expect(calls).toBe(0);
	await name.focus();
	waiting = true;
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect.poll(() => calls).toBe(1);
	await field.fill("B");
	await expect(page.getByRole("button", { name: "Searching…" })).toBeDisabled();
	release();
	waiting = false;
	await expect(
		page.getByRole("button", { name: "Search", exact: true }),
	).toBeEnabled();
	await expect(field).toHaveValue("B");
	await expect(page.getByText(/Current search: A/)).toBeVisible();
	waiting = true;
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect.poll(() => calls).toBe(2);
	await expect(field).toHaveValue("B");
	await page.getByRole("radio", { name: "Exact job ID" }).click();
	await expect(page.getByRole("textbox", { name: "Exact job ID" })).toHaveValue(
		"",
	);
	release();
	waiting = false;
	await expect(
		page.getByRole("textbox", { name: "Exact job ID" }),
	).toBeEnabled();
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

test("polish: long queue content wraps at mobile width", async ({
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
					pages: ["queues"],
				},
			},
		}),
	);
	await page.route("**/rpc/queues/jobs**", (route) =>
		route.fulfill({
			json: {
				json: {
					mode: "browse",
					items: [
						{
							...browserJob,
							name: "profile-with-a-long-unbroken-job-name-and-extra-details",
							failedReason:
								"The worker could not complete this job because the downstream service did not respond within the configured deadline.",
						},
					],
					total: 1,
					page: 1,
					pageSize: 20,
					refreshedAt: new Date().toISOString(),
				},
			},
		}),
	);
	await page.setViewportSize({ width: 390, height: 900 });
	await page.goto("/queues/sample/jobs?status=failed");
	await expect(
		page.getByText(/downstream service did not respond/),
	).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBeTruthy();
	await page.screenshot({
		path: info.outputPath("jobs-long-mobile.png"),
		fullPage: true,
	});
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

test("round2: logs denial remains blocked during retry and across failures", async ({
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
	let code = 404;
	let hold = false;
	let release = () => {};
	let calls = 0;
	await page.route("**/rpc/queues/logs**", async (route) => {
		calls++;
		if (hold)
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		if (code)
			return route.fulfill({
				status: code,
				json: {
					json: {
						defined: false,
						code:
							code === 403
								? "FORBIDDEN"
								: code === 404
									? "NOT_FOUND"
									: "SERVICE_UNAVAILABLE",
						status: code,
						message: "Unavailable",
					},
				},
			});
		return route.fulfill({
			json: {
				json: {
					lines: ["Recovered log"],
					total: 1,
					page: 1,
					pageSize: 50,
					clipped: false,
				},
			},
		});
	});
	for (const failure of [404, 403]) {
		code = failure;
		await page.goto(`/queues/sample/jobs/blocked-${failure}`);
		await expect(page.getByRole("alert")).toBeVisible();
		await expect(page.getByText("Worker could not read profile")).toHaveCount(
			0,
		);
		hold = true;
		const before = calls;
		await page.getByRole("button", { name: "Retry", exact: true }).click();
		await expect.poll(() => calls).toBeGreaterThan(before);
		await expect(page.getByRole("alert")).toBeVisible();
		await expect(page.getByText("Worker could not read profile")).toHaveCount(
			0,
		);
		hold = false;
		const failedRetry = page.waitForResponse(
			(response) =>
				response.url().includes("/rpc/queues/logs") &&
				response.status() === failure,
		);
		release();
		await failedRetry;
		await expect(page.getByRole("alert")).toBeVisible();
		await expect(page.getByText("Worker could not read profile")).toHaveCount(
			0,
		);
		code = 503;
		const beforeTemporaryFailure = calls;
		await page.getByRole("button", { name: "Retry", exact: true }).click();
		await expect
			.poll(() => calls, { timeout: 10000 })
			.toBeGreaterThanOrEqual(beforeTemporaryFailure + 3);
		await expect(page.getByRole("alert")).toBeVisible();
		await expect(page.getByText("Worker could not read profile")).toHaveCount(
			0,
		);
		code = 0;
		await page.getByRole("button", { name: "Retry", exact: true }).click();
		await expect(page.getByText("Recovered log")).toBeVisible();
	}
	code = 404;
	await page.goto("/queues/sample/jobs/blocked-switch");
	await expect(page.getByRole("alert")).toBeVisible();
	code = 0;
	await page.evaluate(() => {
		history.pushState({}, "", "/queues/other/jobs/another");
		window.dispatchEvent(new PopStateEvent("popstate"));
	});
	await expect(page.getByText("Recovered log")).toBeVisible();
});

test("round2: recovered search does not revive old error on refresh", async ({
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
	let phase = "fail";
	let release = () => {};
	let calls = 0;
	await page.route("**/rpc/queues/jobs**", async (route) => {
		calls++;
		if (phase === "slow")
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		if (phase === "fail")
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
	await page.goto("/queues/sample/jobs?mode=name&query=A");
	await expect(page.getByRole("alert")).toBeVisible({ timeout: 15000 });
	phase = "success";
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(page.getByRole("alert")).toHaveCount(0);
	phase = "slow";
	const before = calls;
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect.poll(() => calls).toBeGreaterThan(before);
	await expect(page.getByRole("alert")).toHaveCount(0);
	phase = "fail";
	release();
	await expect(page.getByRole("alert")).toBeVisible({ timeout: 15000 });
});

test("round2: long query and queue key fit the mobile content", async ({
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
	await page.route("**/rpc/queues/jobs**", (route) =>
		route.fulfill({
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
		}),
	);
	await page.route("**/rpc/queues/schedulers**", (route) =>
		route.fulfill({
			json: {
				json: {
					items: [],
					total: 0,
					page: 1,
					pageSize: 20,
					refreshedAt: new Date().toISOString(),
				},
			},
		}),
	);
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
	await page.setViewportSize({ width: 390, height: 900 });
	const key = "q".repeat(64);
	const term = "a".repeat(128);
	await page.goto(`/queues/${key}/jobs?mode=name&query=${term}`);
	const input = page.getByRole("textbox", { name: "Full job name" });
	await expect(input).toHaveValue(term);
	const description = page.locator("#queue-query-description");
	await expect(description).toContainText(term);
	expect(
		await description.evaluate(
			(element) => element.scrollWidth <= element.clientWidth,
		),
	).toBeTruthy();
	for (const locator of [
		input,
		description,
		page.getByText(`${key} · Jobs`),
		page.getByRole("button", { name: "Refresh", exact: true }),
	]) {
		const box = await locator.boundingBox();
		if (!box) throw new Error("Element has no bounding box");
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(390);
	}
	await page.screenshot({
		path: "/tmp/coco-round2-long-query.png",
		fullPage: true,
	});
	await page.screenshot({
		path: "/tmp/coco-round2-long-queue.png",
		fullPage: true,
	});
	await page.evaluate(() => {
		document.body.style.zoom = "2";
	});
	await expect(
		page.getByRole("link", { name: "Schedulers", exact: true }),
	).toBeVisible();
	await page.evaluate(() => {
		document.body.style.zoom = "";
	});
	for (const [path, label] of [
		[`/queues/${key}/schedulers`, `${key} · Schedulers`],
		[`/queues/${key}/jobs/job`, `${key} · job`],
	]) {
		await page.goto(path);
		const box = await page.getByText(label).boundingBox();
		if (!box) throw new Error("Element has no bounding box");
		expect(box.x + box.width).toBeLessThanOrEqual(390);
		await expect(
			page.getByRole("link", { name: /^(Back to )?Jobs$/i }),
		).toBeVisible();
	}
});

test("round3: short viewport scrolls filters and results without clipping", async ({
	page,
}) => {
	test.setTimeout(60000);
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
	let withRows = false;
	await page.route("**/rpc/queues/jobs**", (route) =>
		route.fulfill({
			json: {
				json: {
					mode: "name",
					items: withRows
						? Array.from({ length: 20 }, (_, index) => ({
								...browserJob,
								id: `item-${index}`,
								name: `Result ${index}`,
								failedReason: `Failure ${index}`,
							}))
						: [],
					scannedCount: 100,
					scanTruncated: false,
					resultsTruncated: false,
					refreshedAt: new Date().toISOString(),
				},
			},
		}),
	);
	const key = "q".repeat(64);
	const term = "a".repeat(128);
	const url = `/queues/${key}/jobs?mode=name&query=${term}`;
	await page.setViewportSize({ width: 720, height: 450 });
	await page.goto(url);
	const outer = page.getByRole("main").locator(":scope > div");
	const empty = page.getByText("No matches in the searched range.");
	await expect(empty).toBeAttached();
	await page.mouse.move(600, 400);
	await page.mouse.wheel(0, 700);
	await expect
		.poll(() => outer.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(0);
	const emptyBox = await empty.boundingBox();
	if (!emptyBox) throw new Error("Empty state has no bounds");
	expect(emptyBox.y).toBeGreaterThanOrEqual(0);
	expect(emptyBox.y + emptyBox.height).toBeLessThanOrEqual(450);
	await page.screenshot({ path: "/tmp/coco-round3-fixed-empty.png" });
	withRows = true;
	await page.reload();
	await expect(
		page.getByRole("link", { name: "Result 0", exact: true }),
	).toBeAttached();
	await page.mouse.move(600, 400);
	await page.mouse.wheel(0, 700);
	await expect
		.poll(() => outer.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(0);
	const results = page.locator("table.queue-jobs-table").locator("../..");
	const box = await results.boundingBox();
	if (!box) throw new Error("Results have no bounds");
	expect(box.height).toBeGreaterThan(0);
	await page.mouse.move(
		box.x + box.width / 2,
		Math.min(430, box.y + box.height / 2),
	);
	await page.mouse.wheel(0, 6000);
	await expect
		.poll(() => results.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(0);
	const last = page.getByRole("link", { name: "Result 19", exact: true });
	const lastBox = await last.boundingBox();
	if (!lastBox) throw new Error("Last row has no bounds");
	expect(lastBox.y).toBeGreaterThanOrEqual(0);
	expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(450);
	await page.screenshot({ path: "/tmp/coco-round3-fixed-rows.png" });
	const input = page.getByRole("textbox", { name: "Full job name" });
	await input.focus();
	await page.keyboard.press("Tab");
	await expect(
		page.getByRole("button", { name: "Search", exact: true }),
	).toBeFocused();
	for (const width of [390, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto(url);
		const currentResults = page
			.locator("table.queue-jobs-table")
			.locator("../..");
		await expect(
			page.getByRole("link", { name: "Result 0", exact: true }),
		).toBeVisible();
		const resultBox = await currentResults.boundingBox();
		if (!resultBox) throw new Error("Results have no bounds");
		expect(resultBox.x + resultBox.width).toBeLessThanOrEqual(width);
		await page.mouse.move(
			resultBox.x + resultBox.width / 2,
			resultBox.y + Math.min(resultBox.height / 2, 200),
		);
		await page.mouse.wheel(0, 6000);
		await expect
			.poll(() => currentResults.evaluate((element) => element.scrollTop))
			.toBeGreaterThan(0);
		const finalBox = await page
			.getByRole("link", { name: "Result 19", exact: true })
			.boundingBox();
		if (!finalBox) throw new Error("Last row has no bounds");
		expect(finalBox.y + finalBox.height).toBeLessThanOrEqual(900);
	}
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
	await expect(
		page.getByRole("link", { name: browserJob.name, exact: true }),
	).toBeVisible();
	expect(calls).toBe(1);
	await page.getByRole("link", { name: browserJob.name, exact: true }).click();
	await page.goBack();
	await expect(
		page.getByRole("link", { name: browserJob.name, exact: true }),
	).toBeVisible();
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
	await expect(
		page.getByRole("link", { name: browserJob.name, exact: true }),
	).toBeVisible();
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

test("round1: long queue names leave statuses and links inside the row", async ({
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
	const counts = {
		waiting: 1,
		active: 1,
		delayed: 1,
		completed: 1,
		failed: 1,
		prioritized: 1,
		"waiting-children": 1,
	};
	await page.route("**/rpc/queues/list**", (route) =>
		route.fulfill({
			json: {
				json: [
					{ key: "first", name: "X".repeat(64), paused: false, counts },
					{ key: "second", name: "Y".repeat(64), paused: true, counts },
				],
			},
		}),
	);
	for (const width of [320, 390]) {
		await page.setViewportSize({ width, height: 450 });
		await page.goto("/queues");
		for (const state of ["Running", "Paused"]) {
			const badge = page.getByText(state, { exact: true });
			const row = badge.locator("xpath=ancestor::li");
			const bounds = await row.boundingBox();
			const badgeBounds = await badge.boundingBox();
			expect(
				bounds &&
					badgeBounds &&
					badgeBounds.x >= bounds.x &&
					badgeBounds.x + badgeBounds.width <= bounds.x + bounds.width,
			).toBeTruthy();
			await expect(row.getByRole("link", { name: /Waiting 1/ })).toBeVisible();
		}
	}
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
	for (const label of ["Browse", "Full job name"]) {
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

test("round2: cached error search waits for authorization and runs once", async ({
	page,
}) => {
	await mockSession(page);
	let holdAccess = false;
	let release = () => {};
	let accessCalls = 0;
	await page.route("**/rpc/access/me", async (route) => {
		accessCalls++;
		if (holdAccess)
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		return route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["queues"],
				},
			},
		});
	});
	const terms: string[] = [];
	await page.route("**/rpc/queues/jobs**", (route) => {
		const term = route.request().postDataJSON().json.query;
		terms.push(term);
		return term === "B"
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
	await expect(page.getByRole("alert")).toBeVisible();
	await page.getByRole("textbox", { name: "Full job name" }).fill("A");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect(
		page.getByText("No matches in the searched range."),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Search", exact: true }),
	).toBeEnabled();
	const before = accessCalls;
	holdAccess = true;
	await page.getByRole("textbox", { name: "Full job name" }).fill("B");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect.poll(() => accessCalls).toBeGreaterThan(before);
	await page.waitForTimeout(300);
	expect(terms).toEqual(["B", "A"]);
	holdAccess = false;
	release();
	await expect.poll(() => terms.length).toBe(3);
	await expect(page.getByRole("alert")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Search", exact: true }),
	).toBeEnabled();
	expect(terms).toEqual(["B", "A", "B"]);
});

test("round2: search invalidation while offscreen recovers once after errors", async ({
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
					pages: ["queues", "apps"],
				},
			},
		}),
	);
	let code = 503;
	let calls = 0;
	await page.route("**/rpc/queues/jobs**", (route) => {
		calls++;
		if (code === 0)
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
		return route.fulfill({
			status: code,
			json: {
				json: {
					defined: false,
					code: code === 403 ? "FORBIDDEN" : "SERVICE_UNAVAILABLE",
					status: code,
					message: "Unavailable",
				},
			},
		});
	});
	for (const [failure, recover] of [
		[503, false],
		[403, false],
		[503, true],
	] as const) {
		code = failure;
		await page.goto(`/queues/sample/jobs?mode=name&query=fail-${failure}`);
		await expect(page.getByRole("alert")).toBeVisible();
		const initial = calls;
		await page.evaluate(async () => {
			const { queryClient } = await new Function(
				'return import("/src/utils/orpc.ts")',
			)();
			await queryClient.invalidateQueries({
				predicate: (q: { meta?: { explicitQueueSearch?: boolean } }) =>
					q.meta?.explicitQueueSearch === true,
				refetchType: "none",
			});
		});
		await page.waitForTimeout(200);
		expect(calls).toBe(initial);
		await page.evaluate(() => {
			history.pushState({}, "", "/apps");
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
		await expect(
			page.getByRole("heading", { name: "Tool home" }),
		).toBeVisible();
		await page.evaluate(async () => {
			const { queryClient } = await new Function(
				'return import("/src/utils/orpc.ts")',
			)();
			await queryClient.invalidateQueries({
				predicate: (q: { meta?: { explicitQueueSearch?: boolean } }) =>
					q.meta?.explicitQueueSearch === true,
				refetchType: "none",
			});
		});
		expect(calls).toBe(initial);
		if (recover) code = 0;
		await page.goBack();
		await expect.poll(() => calls).toBe(initial + 1);
		if (recover)
			await expect(
				page.getByText("No matches in the searched range."),
			).toBeVisible();
		else await expect(page.getByRole("alert")).toBeVisible();
		await page.evaluate(() => {
			history.pushState({}, "", "/apps");
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
		await expect(
			page.getByRole("heading", { name: "Tool home" }),
		).toBeVisible();
		await page.goBack();
		if (recover)
			await expect(
				page.getByText("No matches in the searched range."),
			).toBeVisible();
		else await expect(page.getByRole("alert")).toBeVisible();
		await page.waitForTimeout(200);
		expect(calls).toBe(initial + 1);
	}
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

test("round2: navigation away cancels pending cached search", async ({
	page,
}) => {
	await mockSession(page);
	let hold = false;
	let release = () => {};
	let accessCalls = 0;
	await page.route("**/rpc/access/me", async (route) => {
		accessCalls++;
		if (hold)
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		return route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["queues", "apps"],
				},
			},
		});
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
	const previous = accessCalls;
	hold = true;
	await page.getByRole("textbox", { name: "Full job name" }).fill("B");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect.poll(() => accessCalls).toBeGreaterThan(previous);
	await page.evaluate(() => {
		history.pushState({}, "", "/apps");
		window.dispatchEvent(new PopStateEvent("popstate"));
	});
	hold = false;
	release();
	await expect(page).toHaveURL(/\/apps(?:\?|$)/);
	await expect(page.getByRole("heading", { name: "Tool home" })).toBeVisible();
	await page.waitForTimeout(300);
	expect(terms).toEqual(["B", "A"]);
});

test("round2: native inactive invalidation refetches an offscreen search", async ({
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
					pages: ["queues", "apps"],
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
	await page.goto("/queues/sample/jobs?mode=name&query=offscreen");
	await expect(
		page.getByText("No matches in the searched range."),
	).toBeVisible();
	await page.evaluate(() => {
		history.pushState({}, "", "/apps");
		window.dispatchEvent(new PopStateEvent("popstate"));
	});
	await expect(page.getByRole("heading", { name: "Tool home" })).toBeVisible();
	await page.evaluate(async () => {
		const { queryClient } = await new Function(
			'return import("/src/utils/orpc.ts")',
		)();
		await queryClient.invalidateQueries({
			predicate: (q: { meta?: { explicitQueueSearch?: boolean } }) =>
				q.meta?.explicitQueueSearch === true,
			refetchType: "inactive",
		});
	});
	expect(calls).toBe(2);
	await page.goBack();
	await expect(
		page.getByText("No matches in the searched range."),
	).toBeVisible();
	await page.waitForTimeout(200);
	expect(calls).toBe(2);
});

test("round2: explicit cached search joins an existing inactive request", async ({
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
	let hold = false;
	let release = () => {};
	const terms: string[] = [];
	await page.route("**/rpc/queues/jobs**", async (route) => {
		const term = route.request().postDataJSON().json.query;
		terms.push(term);
		if (hold && term === "B")
			await new Promise<void>((resolve) => {
				release = resolve;
			});
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
	await page.evaluate(async () => {
		const { queryClient } = await new Function(
			'return import("/src/utils/orpc.ts")',
		)();
		void queryClient.invalidateQueries({
			predicate: (q: { meta?: { explicitQueueSearch?: boolean } }) =>
				q.meta?.explicitQueueSearch === true,
			refetchType: "inactive",
		});
	});
	await expect.poll(() => terms.length).toBe(3);
	await page.getByRole("textbox", { name: "Full job name" }).fill("B");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect(page).toHaveURL(/query=B/);
	await page.waitForTimeout(200);
	expect(terms).toEqual(["B", "A", "B"]);
	hold = false;
	release();
	await expect(
		page.getByRole("button", { name: "Search", exact: true }),
	).toBeEnabled();
	expect(terms).toEqual(["B", "A", "B"]);
});

for (const moveFocus of [false, true]) {
	test(`round3 fix: retry ${moveFocus ? "respects moved focus" : "restores keyboard focus"}`, async ({
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
		let release = () => {};
		await page.route("**/rpc/queues/jobs**", async (route) => {
			calls++;
			if (calls === 1)
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
		await page.goto("/queues/sample/jobs?mode=name&query=A");
		const retry = page.getByRole("button", { name: "Retry", exact: true });
		await expect(retry).toBeVisible();
		await retry.focus();
		await page.keyboard.press("Enter");
		await expect.poll(() => calls).toBe(2);
		const other = page.getByRole("radio", {
			name: "Exact job ID",
			exact: true,
		});
		if (moveFocus) await other.focus();
		release();
		await expect(page.getByText("Search for A completed.")).toHaveCount(1);
		if (moveFocus) await expect(other).toBeFocused();
		else
			await expect(
				page.getByRole("textbox", { name: "Full job name" }),
			).toBeFocused();
		await expect(page.getByText("Search for A completed.")).toHaveCount(1);
		expect(calls).toBe(2);
	});
}

test("round3 fix: superseding refresh navigation releases its lock", async ({
	page,
}) => {
	await mockSession(page);
	let hold = false;
	let release = () => {};
	let accessCalls = 0;
	await page.route("**/rpc/access/me", async (route) => {
		accessCalls++;
		if (hold)
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		return route.fulfill({
			json: {
				json: {
					role: "user",
					organizationId: "application",
					platformRole: "superadmin",
					pages: ["queues"],
				},
			},
		});
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
	await page.goto("/queues/sample/jobs?mode=name&query=C");
	await expect(
		page.getByText("No matches in the searched range."),
	).toBeVisible();
	await page.evaluate(() => {
		history.pushState({}, "", "/queues/sample/jobs?mode=name&query=A&page=2");
		window.dispatchEvent(new PopStateEvent("popstate"));
	});
	await expect(
		page.getByRole("textbox", { name: "Full job name" }),
	).toHaveValue("A");
	await expect(
		page.getByText("No matches in the searched range."),
	).toBeVisible();
	const before = accessCalls;
	hold = true;
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect.poll(() => accessCalls).toBeGreaterThan(before);
	hold = false;
	await page.evaluate(() => history.go(-2));
	release();
	await expect(
		page.getByRole("textbox", { name: "Full job name" }),
	).toHaveValue("C");
	const search = page.getByRole("button", { name: "Search", exact: true });
	await expect(search).toBeEnabled();
	const beforeSearch = terms.length;
	await search.click();
	await expect.poll(() => terms.length).toBe(beforeSearch + 1);
	await expect(search).toBeEnabled();
});

test("round3 fix: retry completion after scope change cannot restore old focus", async ({
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
	let release = () => {};
	await page.route("**/rpc/queues/jobs**", async (route) => {
		calls++;
		if (calls === 1)
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
		return route
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
	await page.goto("/queues/sample/jobs?mode=name&query=A");
	const retry = page.getByRole("button", { name: "Retry", exact: true });
	await expect(retry).toBeVisible();
	await retry.focus();
	await page.keyboard.press("Enter");
	await expect.poll(() => calls).toBe(2);
	const mode = page.getByRole("radio", { name: "Exact job ID", exact: true });
	await mode.click();
	await expect(
		page.getByRole("textbox", { name: "Exact job ID" }),
	).toBeVisible();
	release();
	await expect(mode).toBeFocused();
	await expect(page.getByText("Search for A completed.")).toHaveCount(0);
	expect(calls).toBe(2);
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

test("job breadcrumb links to real queue jobs in the current workspace", async ({
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
	await page.route("**/rpc/queues/logs**", (route) =>
		route.fulfill({
			json: {
				json: { lines: [], total: 0, page: 1, pageSize: 50, clipped: false },
			},
		}),
	);
	await page.setViewportSize({ width: 390, height: 700 });
	await page.goto("/queues/sample/jobs/long-job-id?workspace=application");
	const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
	await breadcrumb
		.getByRole("button", { name: "Breadcrumb ancestors" })
		.click();
	const queues = page.getByRole("menuitem", { name: "Queues" });
	const jobs = page.getByRole("menuitem", { name: "Jobs" });
	await expect(queues).toHaveAttribute(
		"href",
		/\/queues\?workspace=application/,
	);
	await expect(jobs).toHaveAttribute(
		"href",
		/\/queues\/sample\/jobs\?workspace=application/,
	);
	await expect(page.getByRole("menu")).toContainText("long-job-id");
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
