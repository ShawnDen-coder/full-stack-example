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
	assert.equal(canVisit(access, "/queues"), false);
	assert.equal(
		canVisit(
			{ role: "user", platformRole: "superadmin", pages: [] },
			"/queues/user-profile/jobs",
		),
		true,
	);
	assert.equal(canVisit({ role: "admin", pages: [] }, "/queues"), false);
	assert.equal(landingPath(access), "/apps");
	assert.equal(landingPath({ ...access, pages: [] }), "/apps");
	assert.equal(canVisit({ ...access, pages: [] }, "/apps/"), true);
	assert.equal(canVisit({ ...access, pages: [] }, "/apps/unknown"), false);
	assert.equal(
		canVisit({ ...access, pages: [] }, "/apps/integrations-demo"),
		false,
	);
	assert.equal(
		canVisit({ ...access, pages: ["apps"] }, "/apps/integrations-demo"),
		true,
	);
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
	assert.equal(
		organizationRoles.owner.authorize({ queues: ["read"] }).success,
		false,
	);
	assert.equal(
		organizationRoles.admin.authorize({ queues: ["read"] }).success,
		false,
	);
	assert.equal(
		organizationRoles.member.authorize({ queues: ["read"] }).success,
		false,
	);
	assert.equal(authRoles.user.authorize({ user: ["ban"] }).success, false);
	assert.equal(authRoles.superadmin.authorize({ user: ["ban"] }).success, true);
});
