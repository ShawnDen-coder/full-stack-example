import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// This check provisions a fixture in its disposable Compose database.
assert.ok(process.env.COMPOSE_PROJECT_NAME, "Set a disposable Compose project");
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:8080";
const origin = process.env.PUBLIC_APP_URL || "https://full-stack-example.test";
const headers = { "Content-Type": "application/json", Origin: origin };
assert.equal((await fetch(`${base}/todos`)).status, 200);
const html = await (await fetch(base)).text();
assert.ok(html.includes('id="app"'));
const assets = [...html.matchAll(/(?:src|href)="([^" ]+\.js)"/g)].map(
	(match) => match[1],
);
assert.ok(assets.length);
const visited = new Set();
let foundPublicOrigin = false;
for (const asset of assets) {
	const url = new URL(asset, base).href;
	if (visited.has(url)) continue;
	visited.add(url);
	const response = await fetch(url);
	assert.equal(response.status, 200);
	const code = await response.text();
	assert.ok(!code.includes("http://localhost:3000"));
	foundPublicOrigin ||= code.includes(origin);
	// Follow split chunks too: the RPC URL need not live in the entry bundle.
	for (const match of code.matchAll(
		/["']((?:\.\/|\/?assets\/)[^"' ]+\.js)["']/g,
	)) {
		const path = match[1];
		assets.push(
			path.startsWith("assets/")
				? new URL(`/${path}`, base).href
				: new URL(path, url).href,
		);
	}
}
assert.ok(
	foundPublicOrigin,
	"frontend must contain its configured public origin",
);
const signup = await fetch(`${base}/api/auth/sign-up/email`, {
	method: "POST",
	headers,
	body: JSON.stringify({
		name: "Smoke test",
		email: `${randomUUID()}@example.test`,
		password: "smoke-test-password",
	}),
});
assert.equal(signup.status, 200);
const { user } = await signup.json();
assert.equal(typeof user.id, "string");
const cookies = signup.headers.getSetCookie();
assert.ok(
	cookies.some((value) => /;\s*Secure/i.test(value)),
	"production auth cookie must be Secure",
);
const cookie = cookies.map((value) => value.split(";")[0]).join("; ");
async function rpc(name, input, status = 200) {
	const response = await fetch(`${base}/rpc/${name}`, {
		method: "POST",
		headers: { ...headers, Cookie: cookie },
		body: JSON.stringify({ json: input }),
	});
	assert.equal(response.status, status, `RPC ${name} must return ${status}`);
	return (await response.json()).json;
}
const workspaceId = "application";
const initialAccess = await rpc("access/me", {});
assert.equal(initialAccess.role, "user");
assert.deepEqual(initialAccess.pages, []);
assert.deepEqual(await rpc("access/mine", undefined), []);
await rpc("todo/list", { workspaceId }, 403);

// Signup intentionally grants no membership. Provision only this smoke user,
// using the migrated standard role; do not grant platform/admin privileges.
execFileSync(
	"podman",
	[
		"compose",
		"-f",
		"container/compose.production.yml",
		"exec",
		"-T",
		"postgres",
		"psql",
		"-X",
		"-U",
		"postgres",
		"-d",
		"app",
		"--set=ON_ERROR_STOP=1",
		`--set=user_id=${user.id}`,
		`--set=member_id=${randomUUID()}`,
		`--set=workspace_id=${workspaceId}`,
	],
	{
		input: `INSERT INTO member (id, organization_id, user_id, role, created_at)
VALUES (:'member_id', :'workspace_id', :'user_id', 'member,standard', now());`,
		stdio: ["pipe", "pipe", "inherit"],
	},
);
assert.deepEqual(
	(await rpc("access/mine", undefined)).map((workspace) => workspace.id),
	[workspaceId],
);
const access = await rpc("access/me", { workspaceId });
assert.equal(access.role, "user");
assert.equal(access.platformRole, "user");
assert.equal(access.organizationId, workspaceId);
assert.deepEqual(access.pages, [
	"todos",
	"dashboard",
	"tasks",
	"apps",
	"chats",
]);
const todo = await rpc("todo/create", {
	workspaceId,
	text: "Production smoke task",
});
assert.equal(todo.text, "Production smoke task");
assert.ok(
	(await rpc("todo/list", { workspaceId })).items.some(
		(item) => item.id === todo.id,
	),
);
await rpc("todo/delete", { workspaceId, id: todo.id });
const job = await rpc("users/requestProfile", undefined);
let state;
const deadline = Date.now() + 15000;
do {
	state = await rpc("users/profileJob", job);
	if (state.state === "completed") break;
	assert.notEqual(state.state, "failed");
	await new Promise((resolve) => setTimeout(resolve, 100));
} while (Date.now() < deadline);
assert.equal(state.state, "completed");
assert.equal(state.result.name, "Smoke test");
console.log(
	"Production SPA, secure cookies, same-origin RPC and worker smoke passed",
);
