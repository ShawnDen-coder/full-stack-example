import { expect, test } from "@playwright/test";
import { browserJob, mockSession } from "./feedback-fixtures";

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
	await expect(
		page.getByRole("link", { name: "a", exact: true }),
	).toBeVisible();
	await expect(page.getByText("Search failure summary")).toBeVisible();
	result = "unavailable";
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText(
		"last successful request",
		{ timeout: 15000 },
	);
	await expect(
		page.getByRole("link", { name: "a", exact: true }),
	).toBeVisible();
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
	await expect(page.getByRole("link", { name: "a", exact: true })).toHaveCount(
		0,
	);
	await page.screenshot({
		path: info.outputPath("queue-search-error.png"),
		fullPage: true,
	});
	result = "ok";
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(
		page.getByRole("link", { name: "a", exact: true }),
	).toBeVisible();
	const before = accessCalls;
	result = "forbidden";
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.getByRole("link", { name: "a", exact: true })).toHaveCount(
		0,
	);
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
	await expect(
		page.getByText("First scheduler", { exact: true }),
	).toBeVisible();
	fail = true;
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(page.getByRole("alert")).toBeVisible({ timeout: 15000 });
	await expect(page.getByText("First scheduler", { exact: true })).toHaveCount(
		0,
	);
	fail = false;
	await page.goto("/queues/second/schedulers");
	await expect(
		page.getByText("First scheduler", { exact: true }),
	).toBeVisible();
	await expect(page.getByText(/Page 1 of 2/)).toBeVisible();
});

test("review: mobile job fields, failure summaries, page limit and evidence", async ({
	page,
}, info) => {
	test.setTimeout(60000);
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
			await expect(page.locator("td").getByText(/User ID/)).toBeVisible();
			for (const label of ["Attempts", "Created", "Finished", "Failure"])
				await expect(
					page.locator("td").getByText(label, { exact: true }).first(),
				).toBeAttached();
			if (width < 640)
				for (const label of ["Attempts", "Failure"])
					await expect(
						page.locator("td").getByText(label, { exact: true }),
					).toBeVisible();
			if (width < 640)
				await expect(page.locator(".queue-mobile-time")).toContainText(
					"Finished",
				);
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
	await expect(page.getByText(/Submitted: A/)).toBeVisible();
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
		page
			.getByRole("navigation", { name: "Breadcrumb" })
			.locator("button[aria-current=page]"),
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
		[`/queues/${key}/schedulers`, key],
		[`/queues/${key}/jobs/job`, "job"],
	]) {
		await page.goto(path);
		const current = page
			.getByRole("navigation", { name: "Breadcrumb" })
			.locator("button[aria-current=page]");
		await expect(current).toContainText(label);
		const box = await current.boundingBox();
		if (!box) throw new Error("Element has no bounding box");
		expect(box.x + box.width).toBeLessThanOrEqual(390);
		await expect(
			page.getByRole("link", { name: /^(← )?(Back to )?Jobs$/i }),
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
		page.getByRole("link", { name: "item-0", exact: true }),
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
	const last = page.getByRole("link", { name: "item-19", exact: true });
	await last.scrollIntoViewIfNeeded();
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
			page.getByRole("link", { name: "item-0", exact: true }),
		).toBeVisible();
		const resultBox = await currentResults.boundingBox();
		if (!resultBox) throw new Error("Results have no bounds");
		expect(resultBox.x + resultBox.width).toBeLessThanOrEqual(width);
		await page
			.getByRole("link", { name: "item-19", exact: true })
			.scrollIntoViewIfNeeded();
		const finalBox = await page
			.getByRole("link", { name: "item-19", exact: true })
			.boundingBox();
		if (!finalBox) throw new Error("Last row has no bounds");
		expect(finalBox.y + finalBox.height).toBeLessThanOrEqual(900);
	}
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
		for (const state of ["Not paused", "Paused"]) {
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
	await page.route("**/rpc/access/me", async (route) => {
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
	await page.route("**/rpc/queues/jobs**", async (route) => {
		terms.push(route.request().postDataJSON().json.query);
		if (hold)
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
	const before = terms.length;
	hold = true;
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect.poll(() => terms.length).toBeGreaterThan(before);
	hold = false;
	await page.evaluate(() => history.back());
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
	await expect(breadcrumb.locator("button[aria-current=page]")).toContainText(
		"sample",
	);
	await expect(breadcrumb.locator("button[aria-current=page]")).toContainText(
		"long-job-id",
	);
	await breadcrumb.locator("button[aria-current=page]").click();
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

test("non-queue breadcrumb truncates long titles on narrow screens", async ({
	page,
}) => {
	await mockSession(page);
	for (const width of [320, 390]) {
		await page.setViewportSize({ width, height: 844 });
		await page.goto("/apps/integrations-demo?workspace=application");
		const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
		const current = breadcrumb.locator('[aria-current="page"]');
		await expect(current).toHaveText("Integration examples");
		await expect(current).toHaveCSS("text-overflow", "ellipsis");
		await expect(current).toHaveCSS("overflow", "hidden");
		const currentBox = await current.boundingBox();
		const searchBox = await page
			.getByRole("button", { name: "Search pages" })
			.boundingBox();
		if (!currentBox || !searchBox) throw new Error("Missing header geometry");
		expect(currentBox.x + currentBox.width).toBeLessThanOrEqual(searchBox.x);
		await current.click();
		await expect(page.getByRole("menu")).toContainText("Integration examples");
		await page.keyboard.press("Escape");
	}
});

test("queue board retains browsing scope and separates count failures", async ({
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
	let countFailure: "none" | "unavailable" | "forbidden" = "none";
	await page.route("**/rpc/queues/list**", (route) =>
		countFailure !== "none"
			? route.fulfill({
					status: countFailure === "forbidden" ? 403 : 503,
					json: {
						json: {
							code:
								countFailure === "forbidden"
									? "FORBIDDEN"
									: "SERVICE_UNAVAILABLE",
							status: countFailure === "forbidden" ? 403 : 503,
							message: "Unavailable",
						},
					},
				})
			: route.fulfill({
					json: {
						json: [
							{
								key: "user-profile",
								name: "User profile",
								paused: false,
								counts: {
									waiting: 21,
									active: 2,
									completed: 21,
									failed: 3,
									delayed: 1,
									"waiting-children": 0,
									prioritized: 1,
								},
							},
						],
					},
				}),
	);
	await page.route("**/rpc/queues/jobs**", (route) => {
		const query = route.request().postDataJSON().json;
		const item = {
			id: "job-demo-1",
			name: "sync-profile",
			state: "failed",
			attemptsMade: 3,
			attemptsConfigured: 3,
			timestamp: 1,
			processedOn: null,
			finishedOn: null,
			failedReason: "Example failure",
			summary: { userId: "demo-user" },
		};
		return route.fulfill({
			json: {
				json:
					query.mode === "name"
						? {
								mode: "name",
								items: [item],
								scannedCount: 100,
								scanTruncated: true,
								resultsTruncated: true,
								refreshedAt: new Date().toISOString(),
							}
						: {
								mode: "browse",
								items: [item],
								total: 21,
								page: 2,
								pageSize: 20,
								refreshedAt: new Date().toISOString(),
							},
			},
		});
	});
	await page.goto("/queues/user-profile/jobs?status=failed&page=2");
	await expect(
		page
			.getByRole("navigation", { name: "Breadcrumb" })
			.locator("button[aria-current=page]"),
	).toContainText("user-profile");
	await expect(page.getByText("Example failure")).toBeVisible();
	countFailure = "unavailable";
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.getByText("Example failure")).toBeVisible();
	await expect(page.getByRole("radio", { name: /Failed/ })).toContainText("—", {
		timeout: 15000,
	});
	await page.getByRole("button", { name: "Find job" }).click();
	await page.getByRole("radio", { name: "Full job name" }).click();
	await page
		.getByRole("textbox", { name: "Full job name" })
		.fill("sync-profile");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await expect(page.getByText(/More jobs were not scanned/)).toContainText(
		"More matches were omitted",
	);
	await page.getByRole("button", { name: /Back to browsing/ }).click();
	await expect(page).toHaveURL(/status=failed/);
	await expect(page).toHaveURL(/page=2/);
	for (const width of [1440, 1024, 390]) {
		await page.setViewportSize({ width, height: 900 });
		for (const theme of ["light", "dark"]) {
			await page.evaluate((value) => {
				document.documentElement.classList.remove("light", "dark");
				document.documentElement.classList.add(value);
			}, theme);
			await page.waitForTimeout(500);
			await page.screenshot({
				path: info.outputPath(`queue-board-error-${width}-${theme}.png`),
			});
		}
	}
	countFailure = "forbidden";
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.getByText("Example failure")).toHaveCount(0, {
		timeout: 15000,
	});
	await expect(page.getByRole("alert")).toContainText("Access denied");
});

test("queue detail returns to the same browsing scroll position", async ({
	page,
}, info) => {
	await mockSession(page);
	await page.route("**/rpc/access/me", (route) =>
		route.fulfill({
			json: {
				json: {
					role: "user",
					platformRole: "superadmin",
					organizationId: "application",
					pages: ["queues"],
				},
			},
		}),
	);
	await page.route("**/rpc/queues/list**", (route) =>
		route.fulfill({
			json: {
				json: [
					{
						key: "user-profile",
						name: "User profile",
						paused: false,
						counts: {
							waiting: 20,
							active: 0,
							completed: 0,
							failed: 0,
							delayed: 0,
							prioritized: 0,
							"waiting-children": 0,
						},
					},
				],
			},
		}),
	);
	const job = {
		id: "job-19",
		name: "sync-profile",
		state: "waiting",
		attemptsMade: 0,
		attemptsConfigured: 3,
		timestamp: 1,
		processedOn: null,
		finishedOn: null,
		summary: { userId: "demo" },
		result: {},
		stacktrace: "stack only",
	};
	await page.route("**/rpc/queues/jobs**", (route) =>
		route.fulfill({
			json: {
				json: {
					mode: "browse",
					items: Array.from({ length: 20 }, (_, i) => ({
						...job,
						id: `job-${i}`,
					})),
					total: 20,
					page: 1,
					pageSize: 20,
					refreshedAt: new Date().toISOString(),
				},
			},
		}),
	);
	await page.route("**/rpc/queues/job", (route) =>
		route.fulfill({ json: { json: job } }),
	);
	await page.route("**/rpc/queues/logs**", (route) =>
		route.fulfill({
			json: {
				json: {
					lines: [],
					total: 0,
					page: 1,
					clipped: false,
					refreshedAt: new Date().toISOString(),
				},
			},
		}),
	);
	await page.setViewportSize({ width: 390, height: 700 });
	await page.goto("/queues/user-profile/jobs");
	const last = page.getByRole("link", { name: "job-19", exact: true });
	await last.scrollIntoViewIfNeeded();
	const before = await last.evaluate(
		(element) => element.closest(".overflow-y-auto")?.scrollTop ?? 0,
	);
	expect(before).toBeGreaterThan(0);
	await last.click();
	await expect(page.getByText("stack only")).toBeVisible();
	await page.screenshot({
		path: info.outputPath("queue-detail-scroll.png"),
		fullPage: true,
	});
	await page.getByRole("link", { name: /Back to jobs/ }).click();
	await expect
		.poll(() =>
			page
				.getByRole("link", { name: "job-19", exact: true })
				.evaluate(
					(element) => element.closest(".overflow-y-auto")?.scrollTop ?? 0,
				),
		)
		.toBeGreaterThan(0);
});

test("queue visual fixtures show normal counts and state-specific mobile times", async ({
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
	const states = [
		"waiting",
		"active",
		"completed",
		"failed",
		"delayed",
		"prioritized",
	];
	const base = Date.parse("2026-10-30T01:10:00Z");
	const items = states.map((state, i) => ({
		id: `job-demo-${i}`,
		name: "sync-profile",
		state,
		attemptsMade: i === 3 ? 3 : 1,
		attemptsConfigured: 3,
		timestamp: base + i * 60000,
		processedOn: state === "active" ? base + 600000 : null,
		finishedOn: state === "failed" ? base + 900000 : null,
		failedReason:
			state === "failed"
				? "Upstream service timed out while reading a profile. The request could not be completed after several attempts, and the full diagnostic remains available in job detail."
				: null,
		summary: { userId: `demo-user-${i}` },
	}));
	const counts = {
		waiting: 6,
		active: 2,
		completed: 21,
		failed: 3,
		delayed: 1,
		"waiting-children": 0,
		prioritized: 1,
	};
	await page.route("**/rpc/queues/list**", (route) =>
		route.fulfill({
			json: {
				json: [
					{ key: "user-profile", name: "User profile", paused: false, counts },
				],
			},
		}),
	);
	await page.route("**/rpc/queues/jobs**", (route) => {
		const input = route.request().postDataJSON().json;
		return route.fulfill({
			json: {
				json:
					input.mode === "name"
						? {
								mode: "name",
								items,
								scannedCount: 34,
								scanTruncated: false,
								resultsTruncated: false,
								refreshedAt: new Date().toISOString(),
							}
						: {
								mode: "browse",
								items: items.map((item) => ({
									...item,
									state: "waiting",
									processedOn: null,
									finishedOn: null,
									failedReason: null,
								})),
								total: 6,
								page: 1,
								pageSize: 20,
								refreshedAt: new Date().toISOString(),
							},
			},
		});
	});
	await page.route("**/rpc/queues/job", (route) =>
		route.fulfill({
			json: {
				json: {
					...items[3],
					result: {},
					stacktrace: "Full diagnostic stack",
					refreshedAt: new Date().toISOString(),
				},
			},
		}),
	);
	await page.route("**/rpc/queues/logs**", (route) =>
		route.fulfill({
			json: {
				json: {
					lines: [
						"Profile synchronization started",
						"Upstream request timed out",
					],
					total: 2,
					page: 1,
					pageSize: 50,
					clipped: false,
				},
			},
		}),
	);
	await page.goto("/queues/user-profile/jobs");
	await expect(
		page.getByRole("radio", { name: "Waiting", exact: true }),
	).toContainText("6");
	for (const width of [1440, 1024, 390]) {
		await page.setViewportSize({ width, height: 900 });
		for (const theme of ["light", "dark"]) {
			await page.evaluate((value) => {
				document.documentElement.classList.remove("light", "dark");
				document.documentElement.classList.add(value);
			}, theme);
			await page.waitForTimeout(500);
			await page.screenshot({
				path: info.outputPath(`normal-${width}-${theme}.png`),
			});
		}
	}
	await page.goto("/queues/user-profile/jobs?mode=name&query=sync-profile");
	await expect(page.getByText("6 matches returned")).toBeVisible();
	for (const [index, label] of [
		[0, "Created"],
		[1, "Processed"],
		[2, "Finished"],
		[3, "Finished"],
		[4, "Created"],
		[5, "Created"],
	] as const) {
		const row = page.getByRole("row").filter({
			has: page.getByRole("link", { name: `job-demo-${index}`, exact: true }),
		});
		await expect(row.locator(".queue-mobile-time")).toContainText(label);
		await expect(
			row.locator(".queue-mobile-time .queue-field-label"),
		).toHaveText(label);
		const time =
			index === 2
				? null
				: index === 1
					? items[index].processedOn
					: index === 3
						? items[index].finishedOn
						: items[index].timestamp;
		const expected =
			time === null
				? "—"
				: await page.evaluate(
						(value) =>
							new Intl.DateTimeFormat("en-US", {
								month: "short",
								day: "numeric",
								hour: "2-digit",
								minute: "2-digit",
								hourCycle: "h23",
							}).format(value),
						time,
					);
		await expect(row.locator(".queue-mobile-time span").last()).toHaveText(
			expected,
		);
		await expect(row.locator(".queue-created-time")).toBeHidden();
	}
	const failure = page
		.locator(".queue-failure-summary")
		.filter({ hasText: "Upstream service" });
	await expect(failure).toBeVisible();
	expect(
		await failure.evaluate((el) => el.scrollHeight > el.clientHeight),
	).toBeTruthy();
	for (const theme of ["light", "dark"]) {
		await page.evaluate((value) => {
			document.documentElement.classList.remove("light", "dark");
			document.documentElement.classList.add(value);
		}, theme);
		await page.waitForTimeout(500);
		await page.screenshot({
			path: info.outputPath(`mixed-390-${theme}.png`),
			fullPage: true,
		});
	}
	await page
		.getByRole("link", { name: "job-demo-3", exact: true })
		.scrollIntoViewIfNeeded();
	for (const theme of ["light", "dark"]) {
		await page.evaluate((value) => {
			document.documentElement.classList.remove("light", "dark");
			document.documentElement.classList.add(value);
		}, theme);
		await page.waitForTimeout(500);
		await page.screenshot({
			path: info.outputPath(`mixed-results-390-${theme}.png`),
		});
	}
	await page.getByRole("link", { name: "job-demo-3", exact: true }).click();
	await expect(page.getByText("Full diagnostic stack")).toBeVisible();
	await page.screenshot({
		path: info.outputPath("detail-390-dark.png"),
		fullPage: true,
	});
	await page.evaluate(() => {
		document.documentElement.classList.remove("dark");
		document.documentElement.classList.add("light");
	});
	await page.waitForTimeout(500);
	await page.screenshot({
		path: info.outputPath("detail-390-light.png"),
		fullPage: true,
	});
	const breadcrumb = page
		.getByRole("navigation", { name: "Breadcrumb" })
		.locator("button[aria-current=page]");
	await expect(breadcrumb).toContainText("user-profile");
	await expect(breadcrumb).toContainText("job-demo-3");
	await expect(page.getByRole("heading", { name: "job-demo-3" })).toHaveClass(
		"sr-only",
	);
	await expect(page.getByRole("button", { name: "Copy Job ID" })).toBeVisible();
	await page.getByRole("link", { name: /Back to jobs/ }).click();
	await expect(page).toHaveURL(/mode=name/);
	await expect(page).toHaveURL(/query=sync-profile/);
	await expect(
		page.getByRole("textbox", { name: "Full job name" }),
	).toHaveValue("sync-profile");
	await page.route("**/rpc/queues/schedulers**", (route) =>
		route.fulfill({
			json: {
				json: {
					items: [
						{
							id: "schedule-1",
							name: "sync-profile",
							pattern: "0 * * * *",
							every: null,
							tz: "UTC",
							next: base + 3600000,
							lastTrigger: { kind: "unknown" },
						},
					],
					total: 1,
					page: 1,
					refreshedAt: new Date().toISOString(),
				},
			},
		}),
	);
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/queues");
		await expect(
			page.getByRole("heading", { name: "Queues", exact: true }),
		).toHaveClass("sr-only");
		await expect(
			page.getByRole("link", { name: "User profile" }),
		).toBeVisible();
		await page.screenshot({
			path: info.outputPath(`overview-${width}-light.png`),
		});
		await page.goto("/queues/user-profile/schedulers");
		await expect(
			page
				.getByRole("navigation", { name: "Breadcrumb" })
				.locator("button[aria-current=page]"),
		).toContainText("user-profile");
		await expect(
			page.getByRole("heading", { name: "user-profile schedulers" }),
		).toHaveClass("sr-only");
		await expect(page.getByText("No record")).toBeVisible();
		await page.screenshot({
			path: info.outputPath(`schedulers-${width}-light.png`),
		});
	}
});

test("navigation after retry completion prevents the queued focus restoration", async ({
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
		return calls === 1
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
	await page.goto("/queues/sample/jobs?mode=name&query=A");
	const retry = page.getByRole("button", { name: "Retry", exact: true });
	await expect(retry).toBeVisible();
	await page.evaluate(() => {
		const state = window as unknown as {
			savedRAF: typeof requestAnimationFrame;
			heldFrames: FrameRequestCallback[];
		};
		state.savedRAF = window.requestAnimationFrame;
		state.heldFrames = [];
		window.requestAnimationFrame = (callback) => {
			state.heldFrames.push(callback);
			return 1;
		};
	});
	await retry.focus();
	await page.keyboard.press("Enter");
	await expect(page.getByText("Search for A completed.")).toHaveCount(1);
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(window as unknown as { heldFrames: FrameRequestCallback[] })
						.heldFrames.length,
			),
		)
		.toBeGreaterThan(0);
	await page.evaluate(() => {
		const state = window as unknown as {
			savedRAF: typeof requestAnimationFrame;
		};
		window.requestAnimationFrame = state.savedRAF;
	});
	const mode = page.getByRole("radio", { name: "Exact job ID", exact: true });
	await mode.click();
	await expect(
		page.getByRole("textbox", { name: "Exact job ID" }),
	).toBeVisible();
	await page.evaluate(() => (document.activeElement as HTMLElement).blur());
	await expect
		.poll(() => page.evaluate(() => document.activeElement === document.body))
		.toBe(true);
	await page.evaluate(() => {
		const state = window as unknown as { heldFrames: FrameRequestCallback[] };
		for (const frame of state.heldFrames) frame(performance.now());
	});
	await expect
		.poll(() => page.evaluate(() => document.activeElement === document.body))
		.toBe(true);
	expect(calls).toBe(2);
});
