import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
	scopeTicket,
	updateIdentityScope,
	updateWorkspaceScope,
} from "../src/utils/request-scope.ts";
import { createScopedFetch } from "../src/utils/scoped-fetch.ts";

test("a scope change after headers but before body completion discards the response", async () => {
	updateIdentityScope("stream-user");
	let controller;
	const response = new Response(
		new ReadableStream({
			start(value) {
				controller = value;
			},
		}),
		{ status: 200 },
	);
	const stub = mock.method(globalThis, "fetch", async () => response);
	try {
		const pending = createScopedFetch(scopeTicket)(
			new Request("http://example.test"),
			{},
		);
		await Promise.resolve();
		assert.equal(response.bodyUsed, true);
		updateWorkspaceScope("new-workspace");
		controller.enqueue(new TextEncoder().encode("private body"));
		controller.close();
		await assert.rejects(pending, { name: "AbortError" });
	} finally {
		stub.mock.restore();
	}
});
