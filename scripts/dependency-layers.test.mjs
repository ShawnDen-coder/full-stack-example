import assert from "node:assert/strict";
import { test } from "node:test";
import { checkLayerDependency } from "./dependency-layers.mjs";

const layers = { entry: 3, service: 2, database: 1, telemetry: 1 };

test("internal dependencies may target only the same or adjacent lower layer", () => {
	assert.equal(checkLayerDependency("entry", "service", layers), undefined);
	assert.equal(checkLayerDependency("service", "database", layers), undefined);
	assert.equal(
		checkLayerDependency("database", "telemetry", layers),
		undefined,
	);
	assert.match(checkLayerDependency("entry", "database", layers), /skipped/);
	assert.match(checkLayerDependency("database", "service", layers), /reverse/);
});

test("internal workspaces cannot pretend to be external L0 dependencies", () => {
	for (const level of [0, -1, 1.5, undefined]) {
		assert.match(
			checkLayerDependency("entry", "database", { ...layers, database: level }),
			/invalid internal layer/,
		);
	}
	assert.match(checkLayerDependency("unknown", "database", layers), /invalid/);
});
