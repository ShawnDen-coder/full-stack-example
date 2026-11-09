import assert from "node:assert/strict";
import { test } from "node:test";
import {
	invalidateIdentityScope,
	isScopeCurrent,
	scopeTicket,
	updateIdentityScope,
	updateWorkspaceScope,
} from "../src/utils/request-scope.ts";

test("scope tickets expire only for changes and explicit identity clearing", () => {
	assert.equal(updateIdentityScope("person"), true);
	const first = scopeTicket();
	assert.equal(updateIdentityScope("person"), false);
	assert.equal(scopeTicket(), first);
	assert.equal(updateWorkspaceScope("one"), true);
	assert.equal(isScopeCurrent("person", first), false);
	const second = scopeTicket();
	assert.equal(updateWorkspaceScope("one"), false);
	assert.equal(isScopeCurrent("person", second), true);
	invalidateIdentityScope();
	assert.equal(updateIdentityScope(null), true);
	const cleared = scopeTicket();
	invalidateIdentityScope();
	assert.equal(updateIdentityScope(null), true);
	assert.ok(scopeTicket() > cleared);
});
