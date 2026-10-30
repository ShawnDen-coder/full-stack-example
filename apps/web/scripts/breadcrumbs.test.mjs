import assert from "node:assert/strict";
import { test } from "node:test";
import {
	breadcrumbAncestors,
	breadcrumbTargets,
} from "../src/lib/breadcrumbs.ts";

test("breadcrumb ancestry is logical, permission filtered and uses real typed targets", () => {
	const cases = [
		["todos", undefined, { toolHome: true, queues: false }, ["tool-home"]],
		["todos", undefined, { toolHome: false, queues: true }, []],
		[
			"queue-job",
			"sample",
			{ toolHome: true, queues: true },
			["queues", "queue", "jobs"],
		],
		[
			"queue-jobs",
			"sample",
			{ toolHome: true, queues: true },
			["queues", "queue"],
		],
		[
			"queue-schedulers",
			"sample",
			{ toolHome: true, queues: true },
			["queues", "queue"],
		],
		["queue-job", "sample", { toolHome: true, queues: false }, []],
		["queue-job", undefined, { toolHome: true, queues: true }, []],
	];
	for (const [key, queue, access, expected] of cases)
		assert.deepEqual(breadcrumbAncestors(key, queue, access), expected);
	assert.equal(breadcrumbTargets.queues.to, "/queues");
	assert.deepEqual(breadcrumbTargets.jobs("sample").params, {
		queueKey: "sample",
	});
	assert.equal(breadcrumbTargets.jobs("sample").to, "/queues/$queueKey/jobs");
});
