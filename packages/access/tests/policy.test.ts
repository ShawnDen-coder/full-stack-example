import assert from "node:assert/strict";
import { test } from "node:test";
import { authRoles, organizationRoles } from "../src/auth";
import { canVisit, landingPath } from "../src/index";

test("navigation checks exact path boundaries and keeps basic account access", () => {
	const access = {
		role: "user" as const,
		pages: ["todos" as const],
	};
	assert.equal(canVisit(access, "/todos/"), true);
	assert.equal(canVisit(access, "/todos/42"), true);
	assert.equal(canVisit(access, "/todos-other"), false);
	assert.equal(canVisit(access, "/admin/users"), false);
	assert.equal(canVisit(access, "/settings/account"), true);
	assert.equal(landingPath(access), "/todos");
	assert.equal(landingPath({ ...access, pages: [] }), "/no-access");
});
test("native roles reserve administration for admins and owners", () => {
	assert.equal(
		organizationRoles.member.authorize({ member: ["update"] }).success,
		false,
	);
	assert.equal(
		organizationRoles.admin.authorize({ member: ["update"] }).success,
		true,
	);
	assert.equal(
		organizationRoles.member.authorize({ todos: ["read"] }).success,
		false,
	);
	assert.equal(
		organizationRoles.owner.authorize({ todos: ["read"] }).success,
		true,
	);
	assert.equal(authRoles.user.authorize({ user: ["ban"] }).success, false);
	assert.equal(authRoles.superadmin.authorize({ user: ["ban"] }).success, true);
});
