import assert from "node:assert/strict";
import { test } from "node:test";
import {
	decodeColumnFilters,
	decodePagination,
	encodeColumnFilters,
	encodePagination,
} from "../src/hooks/use-table-url-state.ts";

test("table URL codecs preserve defaults, page conversion and array fallback", () => {
	const filters = [
		{ columnId: "status", searchKey: "status" },
		{ columnId: "name", searchKey: "q", type: "string" },
	];
	assert.deepEqual(
		decodeColumnFilters({ status: ["open"], q: " hello " }, filters),
		[
			{ id: "status", value: ["open"] },
			{ id: "name", value: " hello " },
		],
	);
	assert.deepEqual(
		encodeColumnFilters(
			[
				{ id: "status", value: ["open"] },
				{ id: "name", value: " " },
			],
			filters,
		),
		{ status: ["open"], q: undefined },
	);
	assert.deepEqual(
		decodePagination({ page: 3, pageSize: 20 }, "page", "pageSize", 1, 10),
		{ pageIndex: 2, pageSize: 20 },
	);
	assert.deepEqual(
		encodePagination({ pageIndex: 0, pageSize: 10 }, "page", "pageSize", 1, 10),
		{ page: undefined, pageSize: undefined },
	);
});
